local payouts = {}

local shares = 0

local total = tonumber(ARGV[1])

local index = 0

while shares < total do
	local share = redis.call("LINDEX", KEYS[1], tostring(index))
	if share then
		local s = {}
		local n = 1
		for i in string.gmatch(share, "[%a%d%.]+") do
			s[n] = i
			n = n + 1
		end
		if s then
			if payouts[s[1]] then
				payouts[s[1]] = payouts[s[1]] + s[2]
			else
				payouts[s[1]] = s[2]
			end
			shares = shares + s[2]
		else
			break
		end
	else
		break
	end
	index = index + 1
end

return cjson.encode(payouts)
