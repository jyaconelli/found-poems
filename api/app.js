const express = require('express');
const app = express();
const https = require('https');
const cors = require('cors')
const server = https.createServer(app);
const { Server } = require("socket.io");
const bodyParser = require('body-parser')
const { extract } = require('@extractus/article-extractor')

app.use(cors())

const jsonParser = bodyParser.json()


const io = new Server({
  cors: {
    origin: "*"
  }
});


var urlencodedParser = bodyParser.urlencoded({ extended: false })


function removeTags(str) {
  if ((str===null) || (str===''))
      return false;
  else
      str = str.toString();
        
  // Regular expression to identify HTML tags in
  // the input string. Replacing the identified
  // HTML tag with a null string.
  return str.replace( /(<([^>]+)>)/ig, '');
}

Date.prototype.addMinutes = function (m)  {
  this.setTime(this.getTime() + (m*1000*60))
  return this;
}

var document = []
var article = null
var expires = new Date()

app.post('/set', jsonParser, async (req, res) => {
  const { url } = req.body
  console.log('fetching article from: ' + url)
  try {
    article = await extract(url)
    document = removeTags(article.content).split(' ')
    expires = new Date()
    expires.addMinutes(15)
    io.emit("document", document)
    return res.status(200).json({
      document,
      article,
      expires
    })
  } catch {
    return res.status(500).json({
      message: `Failed to fetch article form URL ${url}`
    })
  }
})

app.get('/document', (req, res) => {
  if (document.length == 0) {
    return res.status(404).json({
      error: `Document empty. Expires at ${expires.toString()}`
    })
  }
  return res.status(200).json({
    document,
    article,
    expires
  })
})

io.on('connection', (socket) => {
  socket.on('documentUpdate', (msg) => {
    if (new Date() < expires) {
      document = msg
      socket.broadcast.emit('document', document)
    }
  });
});

server.listen(9000, () => {
  console.log('listening on *:9000');
});

io.listen(3000);
