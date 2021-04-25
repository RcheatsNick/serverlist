const express = require("express")
const app = express()
const path = require("path");
const passport = require("passport");
const session = require("express-session"); 
const Strategy = require("passport-discord").Strategy;
const url = require("url")
const moment = require("moment")
require("moment-duration-format")

module.exports = client => {
  const db = client.db;
  const bilgiler = { oauthSecret: "", callbackURL: `https://server-list.theclawnz.repl.co/callback`, domain: `https://server-list.theclawnz.repl.co/` };
   
  const dataDir = path.resolve(`${process.cwd()}${path.sep}website`);
  const templateDir = path.resolve(`${dataDir}${path.sep}site${path.sep}`);

  app.use("/css", express.static(path.resolve(`${dataDir}${path.sep}css`)));
  app.use("/js", express.static(path.resolve(`${dataDir}${path.sep}js`)));

  function girisGerekli(req, res, next) {
    if(req.isAuthenticated()) return next();
    req.session.backURL = req.url;
    res.redirect("/giris");
  }

  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  passport.use(new Strategy({
    clientID: client.user.id,
    clientSecret: bilgiler.oauthSecret,
    callbackURL: bilgiler.callbackURL,
    scope: ["identify", "guilds" , "email"]
  },
  (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
  }));

  app.use(session({
    secret: 'whybolu',
    resave: false,
    saveUninitialized: false,
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  app.locals.domain = bilgiler.domain;
  
  app.engine("html", require("ejs").renderFile);
  app.set("view engine", "html");

  var bodyParser = require("body-parser");
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  })); 
   
  
  const yukle = (res, req, template, data = {}) => {
    const baseData = {
      bot: client,
      path: req.path,
      user: req.isAuthenticated() ? req.user : null
    };
    res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));
  };
 
  app.get("/", (req, res) => {
    yukle(res, req, "index.ejs", { req, res })
  });

  app.get("/sunucular", (req, res) => {
    yukle(res, req, "sunucular.ejs", { req, res })
  });

  app.get("/sunucu/:guildID", (req, res) => {
    let server = req.params.guildID
    if(!db.has(server) === true) {
      return res.json({ error: "Bu sunucu bulunamadı!" })
    }
    let millisJoined2 = new Date().getTime() - client.guilds.cache.get(server).createdAt
    let sunucukurulum = moment.duration(millisJoined2).format("Y [Yıl], M [Ay], H [Saat], m [Dakika], s [saniye]")

    yukle(res, req, "sunucu.ejs", { req, res, server, sunucukurulum })
  });

  app.get("/sunucu/:guildID/katil", (req, res) => {
    let server = req.params.guildID
    if(!db.has(server) === true) {
      return res.json({ error: "Bu sunucu bulunamadı!" })
    }

    let data = db.get(server)
    
    if(data.serverInviteURL == null) {
      return res.json({ error: "Bu sunucunun davet linkini bulamadım!" })
    }

    res.redirect(data.serverInviteURL)
  });

  app.get("/sunucu/:guildID/oy", girisGerekli, (req, res) => {
    let server = req.params.guildID
    let timeout = (db.fetch(`${req.user.id}.oySure`) - Date.now())
    let tarih = moment.duration(timeout).format("H [saat], m [dakika], s [saniye]")  

    if(!db.has(server) === true) {
      return res.json({ error: "Bu sunucu bulunamadı!" })
    }

    yukle(res, req, "oy.ejs", { req, res, server, tarih })
  });

  app.post("/sunucu/:guildID/oy", girisGerekli, (req, res) => {
    let server = req.params.guildID
    let timeout = (db.fetch(`${req.user.id}.oySure`) - Date.now())
    let tarih = moment.duration(timeout).format("H [saat], m [dakika], s [saniye]")  

    db.add(`${server}.serverVote`, 1)
    db.set(`${req.user.id}.oySure`, (Date.now() + 86400000))
    
    setTimeout(() => {
      db.delete(`${req.user.id}.oySure`)
    }, 86400000)
    yukle(res, req, "oy.ejs", { req, res, server, tarih })
  });

  app.get("/sunucu/:guildID/duzenle", girisGerekli, (req, res) => {
    let server = req.params.guildID
    let sahip = req.user.id
    
    if(!db.has(server) === true) {
      return res.json({ error: "Bu sunucu bulunamadı!" })
    }

    if(db.get(server).serverOwner !== sahip) {
      return res.json({ error: "Bu sunucunun sahibi sen değilsin!" })
    }

    yukle(res, req, "sunucu-düzenle.ejs", { req, res, server })
  });

  app.post("/sunucu/:guildID/duzenle", girisGerekli, (req, res) => {
    let server = req.params.guildID
    let sahip = req.user.id
    
    if(!db.has(server) === true) {
      return res.json({ error: "Bu sunucu bulunamadı!" })
    }

    if(db.get(server).serverOwner !== sahip) {
      return res.json({ error: "Bu sunucunun sahibi sen değilsin!" })
    }

    function ayarlarKaydetKullanici(kullanici, yeniAyar) {
      if(yeniAyar['kisa']) {
        db.set(`${kullanici}.shortDescription`, yeniAyar['kisa'])
      }

      if(yeniAyar['uzun']) {
        db.set(`${kullanici}.serverDescription`, yeniAyar['uzun'])  
      }

      if(yeniAyar['afis']) {
        db.set(`${kullanici}.serverBackground`, yeniAyar['afis'])  
      }

      if(yeniAyar['yetkili']) {
        db.set(`${kullanici}.staffRole`, yeniAyar['yetkili'])  
      }
    };

    ayarlarKaydetKullanici(server, req.body)

    yukle(res, req, "sunucu-düzenle.ejs", { req, res, server })
  });

  app.get("/profil/:userID", girisGerekli, (req, res) => {
    let user = client.users.cache.get(req.params.userID)
    let ip = (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',').shift()) 

    if(!user) {
      return res.json({ error: "Bu kullanıcı bulunamadı!" })
    }

    if(user.id !== req.user.id) {
      return res.json({ error: "Başkasının profiline bakamazsın!" })
    }

    yukle(res, req, "profil.ejs", { req, res, user, ip })
  });

  app.get("/profil/:userID/duzenle", girisGerekli, (req, res) => {
    let user = client.users.cache.get(req.params.userID)
    let ip = (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',').shift()) 

    if(!user) {
      return res.json({ error: "Bu kullanıcı bulunamadı!" })
    }

    if(user.id !== req.user.id) {
      return res.json({ error: "Başkasının profilini düzenleyemezsin!" })
    }

    yukle(res, req, "profil-düzenle.ejs", { req, res, user, ip })
  });

  app.post("/profil/:userID/duzenle", girisGerekli, (req, res) => {
    let user = client.users.cache.get(req.params.userID)
    
    if(!user) {
      return res.json({ error: "Bu kullanıcı bulunamadı!" })
    }

    if(user.id !== req.user.id) {
      return res.json({ error: "Başkasının profilini düzenleyemezsin!" })
    }

    function ayarlarKaydetKullanici(kullanici, yeniAyar) {
      if(yeniAyar['github']) {
        db.set(`${kullanici.id}.github`, yeniAyar['github'])
      }

      if(yeniAyar['instagram']) {
        db.set(`${kullanici.id}.instagram`, yeniAyar['instagram'])  
      }

      if(yeniAyar['twitter']) {
        db.set(`${kullanici.id}.twitter`, yeniAyar['twitter'])  
      }

      if(yeniAyar['facebook']) {
        db.set(`${kullanici.id}.facebook`, yeniAyar['facebook'])  
      }

      if(yeniAyar['website']) {
        db.set(`${kullanici.id}.website`, yeniAyar['website'])  
      }

      if(yeniAyar['aciklama']) {
        db.set(`${kullanici.id}.aciklama`, yeniAyar['aciklama'])  
      }

      if(yeniAyar['arkaplan']) {
        db.set(`${kullanici.id}.arkaplan`, yeniAyar['arkaplan'])  
      }
    };

    ayarlarKaydetKullanici(user, req.body)
    yukle(res, req, "profil-düzenle.ejs", { req, res, user })
  });

  app.get("/siralama/oy", (req, res) => {
    yukle(res, req, "oy-siralama.ejs", { req, res })
  });

  app.get("/siralama/ses", (req, res) => {
    yukle(res, req, "ses-siralama.ejs", { req, res })
  });
   
  app.get("/davet", (req, res) => {
    res.redirect(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=8`)
  })

  app.get("/giris", (req, res, next) => {
    if(req.session.backURL) { 
      req.session.backURL = req.session.backURL; 
    } else if(req.headers.referer) {
      const parsed = url.parse(req.headers.referer);
      if(parsed.hostname === app.locals.domain) {
        req.session.backURL = parsed.path;
      }
    } else {
      req.session.backURL = "";
    }
    next();
  }, passport.authenticate("discord"));

  app.get("/callback", passport.authenticate("discord", { failureRedirect: "/giris" }), async (req, res) => {
    if (req.session.backURL) {
      const url = req.session.backURL;
      req.session.backURL = null;
      res.redirect(url);
    } else {
      res.redirect("/");
    }
  });

  app.get("/cikis", function(req, res) {
    req.session.destroy(() => {
      req.logout();
      res.redirect("/");
    });
  });

  app.use(function(req, res, next) {
    res.status(404);
    yukle(res, req, "404.ejs", { req, res })
  });
 
  console.log("[WebSite]: Aktif")
  app.listen(3000, console.log("[Port]: Aktif"))
}
