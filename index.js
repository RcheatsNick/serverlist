const Discord = require("discord.js")
const client = new Discord.Client()
const efdb = require("efdb")
const db = new efdb({
  "databaseName": "database",
  "databaseFolder": "database",
  "adapter": "YamlDB",
  "autoFile": true,
  "ignoreWarns": true
})

client.db = db;

client.on("ready", () => {
  require("./app.js")(client)
  console.log("[Bot]: Aktif")
})

client.on("guildCreate", async(guild) => {
    guild.channels.cache.random().createInvite().then(invite => { 
      db.set(guild.id, {
        serverName: guild.name,
        serverIcon: guild.iconURL({ dynamic: true }),
        serverInviteURL: invite.url,
        serverID: guild.id,
        serverDescription: null,
        serverVote: 0,
        serverOwner: guild.ownerID
      })
    })
})

client.on("guildDelete", async(guild) => {
  if(db.has(guild.id) === true) {
    db.delete(guild.id)
  }
})

client.login("")
