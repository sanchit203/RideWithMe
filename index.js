require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const  mongoose = require('mongoose');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const session = require("express-session");
const lodash = require("lodash");
const findOrCreate = require('mongoose-findorcreate');
const flash = require('connect-flash');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const port = process.env.PORT||3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname+"/public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true, useUnifiedTopology: true});

const userSchema = new mongoose.Schema({
    username : String,
    password : String,
    googleId : String,
    facebookId : String,
    phoneNo : String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/index"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    if(req.isAuthenticated())
    {
        res.render("index");
    }
    else{
        res.redirect("/signin");
    }
});

app.get("/auth/google", function(req, res)
{
    passport.authenticate('google', { scope: ["profile"] });
});

app.get("/auth/google/index", 
  passport.authenticate('google', { failureRedirect: "/signin" }),
  function(req, res) {
    res.redirect('/');
  });

app.get("/signin", function(req,res){
    res.render("signin",{message : req.flash()});
});

app.get("/signup", function(req,res){
    res.render("signup", {message : ""});
})

app.post("/signup", function(req, res, next){
    User.findOne({username: req.body.username},function(err, user){
        if(err){
            console.log(err);
        }
        else{
            if(user){
                res.render("signup", {message : "Username already exist! Please SignIn"});
            }
            else{
                User.register(new User({username: req.body.username}), req.body.password, function(err, user){
                    if(err){
                        console.log('error while user register!', err);
                        return next(err);
                    }
                    req.login(user, function(err){
                        if(err){
                            console.log(err);
                        }
                        else{
                            res.redirect("/");
                        }
                    })
                });
            }
        }
    });
});



app.post('/signin', passport.authenticate('local', { failureRedirect: '/signin', failureFlash: 'Invalid username or password.' }), function(req, res) {
    res.redirect('/');
});

app.listen(port, () => { console.log("Server runnig!");})