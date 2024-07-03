var express = require("express");
var app = express();
const url = require('url');
var bodyparser = require('body-parser');
var fs = require("fs");
var session = require('express-session');
var mysql = require("mysql");
const bcrypt = require('bcrypt');
var path = require('path');

// var formidable = require('formidable')

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'static', 'html'));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true })); 
app.use(express.static(__dirname + '/static')); 
app.use(session({
  secret: 'hide', 
  saveUninitialized: true,
  resave: false
}));


var connection = mysql.createConnection({
  host: "hidden",
  user: "hidden",
  password: "hidden",
  database: "hidden",
  port: 3306
});
connection.connect(function(err) {
  if (err) {
      throw err;
  };
});
function requireLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/',function(req, res) {
  res.render('welcome');
});
app.get('/welcome',function(req, res) {
  res.render('welcome');
});
app.get('/addEvent', requireLogin, function(req, res) {
  res.render('addEvent');
});
app.get('/editEvent', requireLogin, function(req, res) {  
  const id = req.query.id;
  // if edit event called from navigation instead of a row
  if(typeof id == "undefined") {
    const values = {id: "", name: "", day: "Sunday", start: "", end: "", loc: "", phone: "", info: "", url: ""};
    const fields = JSON.parse(JSON.stringify(values))
    res.render('editEvent', {values: fields});
  }
  // if editEvent is clled from a row
  else{
    console.log("id is", id);
    connection.query(`SELECT * FROM tbl_events WHERE event_id = '${id}'`, function(err, results) {
      if(err) {
        res.status(422).json({ error: err });
        return;
      }
      if(results.length == 0) {
        res.status(404)
        .set('Content-Type', 'text/plain')
        .send('404 Not Found');
      }
      else{
        const fields = JSON.parse(JSON.stringify(results))[0]
        res.render('editEvent', {values: fields});
      }
    });
  }
});
app.get('/login',function(req, res) {
  if(req.session.user){
    res.redirect(302, 'schedule');
  }
  else{
    res.render('login');
  }
});
app.get('/createAccount',function(req, res) {
  res.render('createAccount');
});
app.get('/schedule', requireLogin, function(req, res) {
  res.render('schedule');
});
app.get('/GETschedule', function(req, res) {
  const day = req.query.q.toLowerCase();
  connection.query(`SELECT * FROM tbl_events WHERE event_day="${day}"`, function(err, results) {
    if (err) {
      console.error("Error fetching schedule data:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.json(results);
    }
  });
});

app.post('/login', function (req, res) {
  const { username, password } = req.body;
  connection.query(`SELECT acc_password FROM tbl_accounts WHERE acc_login="${username}"`, function(err, results) {
      if (err) {
          res.status(500).json({ error: "Internal server error" });
          return;
      }

      if (results.length === 0) {
          res.status(401).json({ error: 'User Not Found' });
          return;
      }
      const hashedPassword = results[0].acc_password;
      bcrypt.compare(password, hashedPassword, function(err, result) {
          if (err) {
              res.status(500).json({ error: "Internal server error" });
              return;
          }
          if (result) {
              req.session.user = username;
              res.redirect(302, '/schedule');
          } else {
              res.status(401).json({ error: 'Incorrect password' });
          }
      });
  });
});
app.post('/createAccount', function (req, res){
  const { username, password } = req.body;
  console.log(username, password);
  connection.query(`SELECT * FROM tbl_accounts WHERE acc_login="${username}"`, function(err, results) {
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (results.length > 0) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    bcrypt.hash(password, 10, function(err, hashedPassword) {
      if (err) {
        res.status(500).json({ error: "Internal server error" });
        return;
      }

      let cq = `INSERT INTO tbl_accounts (acc_login, acc_password) VALUES ('${username}', '${hashedPassword}')`;
      connection.query(cq, function(err, results) {
        if (err) {
          res.status(500).json({ error: "Internal server error" });
          return;
        }

        req.session.user = username;
        res.redirect(302, '/schedule');;
      });
    });
  });
});
app.post('/addEvent', function(req, res) {
  const event_details = {
    event_day: req.body.day,
    event_event: req.body.event,
    event_start: req.body.start,
    event_end: req.body.end,
    event_phone: req.body.phone,
    event_location: req.body.location,
    event_info: req.body.info,
    event_url: req.body.url
  };
  connection.query('INSERT INTO tbl_events SET ?', event_details, function(err, results) {
    if (err) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.redirect(302, '/schedule');
    }
  });
});
app.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
      if (err) {
          res.status(500).send('Logout failed');
      } else {
          res.redirect(302, '/login');
      }
  });
});
app.post('/UPDATEevent', function(req, res) {
  const event_details = {
    event_id: parseInt(req.body.id),
    event_day: req.body.day,
    event_event: req.body.event,
    event_start: req.body.start,
    event_end: req.body.end,
    event_phone: req.body.phone,
    event_location: req.body.location,
    event_info: req.body.info,
    event_url: req.body.url
  };
  console.log(event_details);
  connection.query(`SELECT * FROM tbl_events WHERE event_id = '${event_details.event_id}'`, function(err, results) {
    if (err) {
      res.status(422).json({ error: err.message});
    } else if (results.length == 0){
      res.status(404)
      .set('Content-Type', 'text/plain')
      .send('404 - Event Not found');
    } else {
      connection.query(`UPDATE tbl_events SET ? WHERE event_id = '${event_details.event_id}'`, event_details, function(err, results){
        if (err) {
          res.status(422).json({ error: err.message});
        } else {
          res.redirect(302, '/schedule');
        }
      });      
    }
  });




});
app.delete('/DELETErecord', function(req, res) {
  const id = req.query.id;
  console.log("id is", id);
  connection.query(`SELECT * FROM tbl_events WHERE event_id = '${id}'`, function(err, results) {
    if(err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if(results.length == 0) {
      res.status(404)
      .set('Content-Type', 'text/plain')
      .send('404 Not Found');
    }
    else{
        connection.query(`DELETE FROM tbl_events WHERE event_id='${id}'`, function(err, results) {
        if (err) {
          console.error("Error deleting record:", err);
          res.status(500).json({ error: "Internal server error" });
        } else {
          res.status(200).send('OK');
        }
      });
    }
  });
});

app.get('*', function(req, res) {
  res.status(404)
  .set('Content-Type', 'text/plain')
  .send('404 Not Found');
});

const PORT = 9007;
app.listen(PORT, () => console.log(`Listening on port ${PORT}!`));