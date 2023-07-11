const https = require("https");
const fs = require("fs")
const express = require("express");
const session = require("express-session");
const path = require('path');
const bodyParser = require('body-parser')
const Cache = require("node-cache");
const cryptoCache = new Cache({ stdTTL: 60 * 5 });

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ type: 'application/*+json' }));

https
.createServer(    {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert"),
},
app)
.listen(4000, ()=>{
  console.log('Server started at https://localhost:4000');
});

app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: 'keyboard cat',
  cookie: { maxAge: 60000 }
}));

/*
  Default page.
*/
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname, '/index.html'));
});

/*
 Login classic user.
*/
app.post('/login', (req, res) => {
  if (req.session?.isAuthenticated === true)
  {
    res.send('You re already logged');
    return;
  }
  
  let username = req.body.username;
  let password = req.body.password;
  if (username === 'toto' && password === 'toto') {
    req.session.isAuthenticated = true;
    req.session.user = {
      username: username
    };
    res.send('Login successful');
    return;
  }
  else {
    res.status(403);
    req.session.isAuthenticated = false;
    res.send('Login failed');
    return;
  }
});

/*
  Save for current user the passkey informations.
*/
app.post('/subscribe', async (req, res) => {
  let credAssertion = req.body;
  let user = {
    username: req.session.user.username,
    credential: {
      id: credAssertion.id,
      rawId: credAssertion.rawId,
      type: credAssertion.type,
      response: {
        attestationObject: credAssertion.response.attestationObject,
        clientDataJSON: credAssertion.response.attestationObject
      }
    }
  };
  
  let users = cryptoCache.get('users');
  if (users === undefined)
  {
    users = [];
    users.push(user);
  }
  else 
  {
    users = users.map(u => {
      if (u.id === user.id){
        return user;
      }
      return u;
    });
  }
  
  cryptoCache.set('users', users);
  
  res.send('subscription OK');
  return;
});

/*
 Logout user.
*/
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.send('Logout successful');
  return;
});

/*
  Compare passkey id with passkey id users list.
*/
app.post('/loginpasskey', (req, res) => {
  if (req.session?.isAuthenticated === true)
  {
    res.send('You re already logged');
    return;
  }
  
  let users = cryptoCache.get('users');
  if (users === undefined)
  {
    res.status(403);
    req.session.isAuthenticated = false;
    res.send('Login failed');
    return;
  }
  
  let user = users.find(u => {
    return u.credential.id === req.body.id;
  });
  
  if (user === undefined) {
    res.status(403);
    req.session.isAuthenticated = false;
    res.send('Login failed');
    return;
  }
  else {
    req.session.isAuthenticated = true;
    req.session.user = {
      username: user.username
    };
    res.send(user.username);
    return;
  }
});