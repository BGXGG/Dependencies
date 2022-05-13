const fs = require('fs'), path = require('path');

function rvaToOFF(sections, address) {
    for (var i = 0; i < sections.length; i++) {
        if (address >= sections[i][1] && address < sections[i][1] + sections[i][0])
            return address - sections[i][1] + sections[i][2];
    }
    return 0;
}

function walkTree(d, res) {
    let list = fs.readdirSync(d);
    list.forEach((name) => {
        let file = path.resolve(d, name),
        stat = fs.statSync(file);

        if (stat && stat.isDirectory()) {
            walkTree(file, res);
        } else if (d.includes('plugins')) {
            var fileSize = stat.size;
            var buffer = Buffer.alloc(fileSize);
            var fileHandle = fs.openSync(file, 'r');
            fs.readSync(fileHandle, buffer, 0, fileSize, 0);
            fs.closeSync(fileHandle);
			
            if (buffer.readUInt16LE(0) == 0x5A4D) {
                var pluginObject = {};
                pluginObject.name = name.substring(0, name.lastIndexOf('.'));
		pluginObject.fileName = name;
                pluginObject.updateTime = parseInt(stat.mtimeMs / 1000);

                var e_lfanew = buffer.readUInt32LE(0x3C);
                var Machine = buffer.readUInt16LE(e_lfanew + 0x4 + 0x0);
                var NumberOfSections = buffer.readUInt16LE(e_lfanew + 0x4 + 0x2);
                var SizeOfOptionalHeader = buffer.readUInt16LE(e_lfanew + 0x4 + 0x10);

                var sections = [];
                for (var i = 0; i < NumberOfSections; i++) {
                    var sectionBase = e_lfanew + 0x18 + SizeOfOptionalHeader + (i * 0x28);

                    sections.push([buffer.readUInt32LE(sectionBase + 0x8), buffer.readUInt32LE(sectionBase + 0xC), buffer.readUInt32LE(sectionBase + 0x14)]);
                }

                var IMAGE_FILE_MACHINE_I386 = Machine == 0x014c;
                var exportDirectory = 0;
                if (IMAGE_FILE_MACHINE_I386)
                    exportDirectory = e_lfanew + 0x78 + (0x8 * 0);
                else
                    exportDirectory = e_lfanew + 0x88 + (0x8 * 0);

                var exportTable = rvaToOFF(sections, buffer.readUInt32LE(exportDirectory));
                var NumberOfNames = buffer.readUInt32LE(exportTable + 0x18);
                var AddressOfFunctions = buffer.readUInt32LE(exportTable + 0x1C);
                var AddressOfNames = buffer.readUInt32LE(exportTable + 0x20);
                var AddressOfNameOrdinals = buffer.readUInt32LE(exportTable + 0x24);

                for (var i = 0; i < NumberOfNames; i++) {
                    var nameAddress = rvaToOFF(sections, buffer.readUInt32LE(rvaToOFF(sections, (AddressOfNames + (i * 0x4)))));

                    var nameSize = 0;
                    for (nameSize = 0; ; nameSize++) {
                        if (buffer.readUInt8(nameAddress + nameSize) == 0x00)
                            break;
                    }

                    var exportName = buffer.toString('utf8', nameAddress, nameAddress + nameSize);
                    var exportOrd = buffer.readUInt16LE(rvaToOFF(sections, (AddressOfNameOrdinals + (i * 0x2))));
                    var exportAddress = rvaToOFF(sections, buffer.readUInt32LE(rvaToOFF(sections, (AddressOfFunctions + (exportOrd * 0x4)))));

                    if (exportName == "supported_champions") {
                        var champions = [];
                        var champion = buffer.readUInt32LE(exportAddress);
                        while (champion != 5000) {
                            champions.push(champion);
                            exportAddress += 4;
                            champion = buffer.readUInt32LE(exportAddress);
                        }

                        pluginObject.supported = champions;
                    } else if (exportName == "plugin_name") {
                        var pluginNameSize = 0;
                        for (pluginNameSize = 0; ; pluginNameSize++) {
                            if (buffer.readUInt8(exportAddress + pluginNameSize) == 0x00)
                                break;
                        }

                        var pluginName = buffer.toString('utf8', exportAddress, exportAddress + pluginNameSize);

                        pluginObject.name = pluginName;
                    } else if (exportName == "type_plugin") {
			 pluginObject.plugin_type = buffer.readUInt32LE(exportAddress);
		    }
                }

                res.push(pluginObject);
            }
        }
    });

    return res;
}

fs.writeFileSync('plugins.json', JSON.stringify(walkTree('files/', []), null, '\t'));
