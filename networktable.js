var Dissolve = require("dissolve"),
	Concentrate = require("concentrate"),
    net = require("net");

var entries = new Array();

function processAssignmentValue(stack)
{
	switch ( stack.vars.valueType )
	{
		case 0x00: // Boolean
			stack = stack.uint8("value");
			break;
			
		case 0x01: // Double
			stack = stack.doublebe("value");
			break;
		default:
			stack.vars.value = "unknown";
			break;
	}
	return stack;
}

function packAssignmentValue(stack, value)
{
	if ( typeof value == "boolean" )
		stack = stack.uint8(value?0x01:0x00);
	else if ( typeof value == "number" )
		stack = stack.doublebe(value);
	else 
		stack = stack.uint8(0);
	return stack;
}

function getAssignmentValueType(value)
{
	if ( typeof value == "boolean" )
		return 0x00;
	else if ( typeof value == "number" )
		return 0x01;
	return 0x01;
}

var parser = Dissolve().loop(function() 
{
	this.uint8("msgType").tap(function()
	{
		if ( this.vars.msgType == 0x10 ) // Entry Assignment
		{
			this.uint8("keyLength")
			.string("key")
			.uint8("valueType")
			.uint16("entryID")
			.uint16("sequence").tap(function() 
			{
				processAssignmentValue(this).tap(function() {
					entries[this.vars.entryID] = this.vars;
					this.push(this.vars);
					this.vars = {};
				});
			});
		}
		else if ( this.vars.msgType == 0x11 )
		{
			this.uint16("entryID").
			uint16("sequence").tap(function() {
				processAssignmentValue(this).tap(function() {
					entries[this.vars.entryID].value = this.vars.value;
					this.push(this.vars);
					this.vars = {};
				});
			});
		}
	});
});

exports.connect = function(host)
{
	sock = net.connect(1735, host, function()
	{
		sock.pipe(parser);
	});
};

exports.get = function(key)
{
	for ( k in entries )
	{
		if (entries[k].key == key)
			return entries[k].value;
	}
	return undefined;
};

exports.set = function(key, value)
{
	entry = exports.get(key);
	var data = undefined;
	if ( entry == undefined )
	{
		data = Concentrate()
			.uint8(0x10)
			.uint8(key.length).string(key)
			.uint8(getAssignmentValueType(value))
			.uint16(0xFFFF)
			.uint16(0x01);
		packAssignmentValue(data, value);	
	}
	else
	{
		entry.sequence++;
		data = Concentrate()
			.uint8(0x11)
			.uint16(id)
			.uint16(entry.sequence);
		packAssignmentValue(data, value);	
	}
	socket.write(data.result(), "binary");
};

