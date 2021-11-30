const fs = require('fs'), path = require('path'), util = require('util'), md5File = require('md5-file')

function walkTree(d, res) {
	let list = fs.readdirSync(d);
	
    list.forEach((name) => {
		let tempResults = {}, file = path.resolve(d, name), stat = fs.statSync(file);

		if (stat && stat.isDirectory()) {
			walkTree(file, tempResults);
			res[name] = tempResults;
		} else {
			res[name] = md5File.sync(path.resolve(d, name));
		}
	});
	
	return res
}


fs.writeFileSync('../checksums.json', JSON.stringify(walkTree('../files/', {}), null, '\t'));