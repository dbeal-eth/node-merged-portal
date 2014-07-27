var crypto = require('crypto');

var base58 = require('base58-native');

exports.sha256 = function(data) {
	return crypto.createHash('sha256').update(crypto.createHash('sha256').update(data).digest()).digest().reverse();
};

exports.intEncodeHex = function(data) {
	var buf = new Buffer(4);
	buf.writeUInt32LE(data,0);
	return buf.toString('hex');
};

exports.intDecodeHex = function(data) {
	var buf = new Buffer(data, 'hex');
	return buf.readUInt32LE(0);
};

exports.time = function(data) {
	return Math.round(Date.now() / 1000);
};

exports.average = function(array) {
	var sum = 0;

	for(var i = 0;i < array.length;i++) {
		sum += array[i];
	}

	return sum / array.length;
};
exports.verify = function(address) {
	var d;
	try {
		d = base58.decode(address);

	} catch(err) {
		return false;
	}

	if(d[0] != 30) return false;

	return true;
};

//to round to n decimal places
exports.round = function(num, places) {
	var multiplier = Math.pow(10, places);
	return Math.round(num * multiplier) / multiplier;
};

exports.hashrateString = function(hr) {
	var  names = [
		'',
		'K',
		'M',
		'G',
		'T'
	];
	var ext = 'h/s';

	var n = 0;
	while(hr > 999) {
		hr = hr / 1000;
		n++;
	}

	return exports.round(hr, 2) + names[n] + ext;
};
