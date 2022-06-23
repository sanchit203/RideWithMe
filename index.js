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
    //googleId : String,
    //facebookId : String,
    //phoneNo : String,
    ridesPublished : [{_id : String, seats : Number}],
    ridesBooked : [{_id : String , seats : Number}]
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

/* passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/index"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
)); */

var id = "";

app.get("/", function(req, res){
    res.render("search");
});

/* app.get("/auth/google", function(req, res)
{
    passport.authenticate('google', { scope: ["profile"] });
});

app.get("/auth/google/index", 
  passport.authenticate('google', { failureRedirect: "/signin" }),
  function(req, res) {
    res.redirect('/');
  }); */

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
                            if(id=="")
                            {
                                res.redirect("/");
                            }
                            else
                            {
                                res.redirect("/rides/"+id);
                            }
                        }
                    })
                });
            }
        }
    });
});



app.post('/signin', passport.authenticate('local', { failureRedirect: '/signin', failureFlash: 'Invalid username or password.' }), function(req, res) {
    if(id == ""){
        res.redirect('/');
    }
    else
    {
        res.redirect("/rides/"+id);
    }
});

//Routes for search panel;

const rideSchema = new mongoose.Schema({
    starting : String,
    going : String,
    date : String,
    seats : Number,
    onwerId : String,
    passangerIds : [{_id : String, seats: Number}]
})

const Rides = mongoose.model("Rides", rideSchema);

app.post("/", function(req, res){
    Rides.find({starting : req.body.starting, going : req.body.going, date : req.body.date}, function(err, rideList){
        if(!err)
        {
            res.render("rides",{starting : req.body.starting, going : req.body.going, rideItems : rideList})
        }
        else
        {
            console.log(err);
            res.send("Some error occurred");
        }
    })
});

app.get("/publish", function(req, res){
    if(req.isAuthenticated())
    {
        res.render("publish");
    }
    else{
        res.redirect("/signin");
    }
});

app.post("/publish", function(req, res){
    const ride = new Rides({
        starting : req.body.starting,
        going : req.body.going,
        seats : req.body.seats,
        date : req.body.date,
        onwerId : req.user._id
    })

    ride.save(function(err, result){
        if(err){
            console.log(err);
        }
        else{
            User.findByIdAndUpdate(req.user._id, {$push : {ridesPublished : {_id : result._id, seats : req.body.seats}}}, function(er, RES){
                if(!er)
                {
                    res.redirect("/publishedrides");
                }
                else
                {
                    console.log(er);
                }
            });
        }
    })
});

//rides routes
app.get("/rides/:rideId", function(req, res){
    const rideId = req.params.rideId;
    Rides.findById(rideId, function(err, ride){
        if(err)
        {
            console.log(err);
        }
        else{
            var same = "false";
            if(req.isAuthenticated() && ride.onwerId == req.user._id)
            {
                same = "true";
            }
            if(req.isAuthenticated()){
                for(var i= 0;i<ride.passangerIds.length;i++)
                {
                    if(req.user._id == ride.passangerIds[i]._id)
                    {
                        same = "true";
                    }
                }
            }
            res.render("ride_detail",{ride: ride, check : same})
        }
    });
});

app.post("/rides/:rideId", function(req, res){
    if(req.isAuthenticated())
    {
        id = "";
        const rideId = req.params.rideId;
        Rides.findByIdAndUpdate(rideId, {$inc: {seats : -req.body.seats}, $push: {passangerIds :{_id: req.user._id, seats: req.body.seats}}}, function(err, result){
            if(err)
            {
                console.log(err);
            }
            else{
                User.findByIdAndUpdate(req.user._id, {$push : {ridesBooked : {_id : result._id, seats: req.body.seats}}}, function(er, RES){
                    if(!er)
                    {
                        res.redirect("/bookedrides");
                    }
                    else
                    {
                        console.log(er);
                    }
                });
            }
        });
    }
    else
    {
        id = req.params.rideId;
        res.redirect("/signin");
    }
});

app.get("/publishedrides", function(req, res){
    if(req.isAuthenticated()){
        Rides.find().where('_id').in(req.user.ridesPublished).exec((err, records) => {
            if(err)
            {
                console.log(err);
            }
            else
            {
                res.render("publishedrides",{ridesPublished : records});
            }
        });
    }
    else
    {
        res.redirect("/signin");
    }
})

app.get("/bookedrides", function(req, res){
    if(req.isAuthenticated()){
        Rides.find().where('_id').in(req.user.ridesBooked).exec((err, records) => {
            if(err)
            {
                console.log(err);
            }
            else
            {
                res.render("bookedrides",{ridesBooked : records});
            }
        });
    }
    else
    {
        res.redirect("/signin");
    }
})

app.listen(port, () => { console.log("Server runnig!");})