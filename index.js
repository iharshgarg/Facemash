const express = require('express')
const cors = require('cors')
const session = require('express-session')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const mongoose = require('mongoose')
const http = require('http')
const socketIo = require('socket.io')

const Facemash = express();
const port = 3000

Facemash.use(express.json());
Facemash.use(cors({
  origin: ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://192.168.1.5:3000'],
  credentials: true
}))

Facemash.use(express.static(path.join(__dirname, 'public')))

Facemash.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

mongoose.connect('mongodb+srv://iharshgarg:2NzAVwqf7J0UuyOU@cluster0.nb2qd.mongodb.net/facemash', { useNewUrlParser: true, useUnifiedTopology: true })
  .catch(err => console.error('failed to connect mongo-server', err))

const userSchema = new mongoose.Schema({
  uname: { type: String, unique: true, required: true },
  fName: String,
  lName: String,
  pass: { type: String },
  dob: Date,
  sex: { type: String, enum: ['Male', 'Female'] },
  contact: String,

  friends: [String],
  friendRequests: [String]
})
const postSchema = new mongoose.Schema({
  uname: { type: String, required: true },
  fName: String,
  lName: String,
  content: String,
  image: String,
  createdAt: { type: Date, default: Date.now },
  comments: [{ commenter: String, commentContent: String },]
})

const conversationSchema = new mongoose.Schema({
  participants: { type: [String], required: true },
  messages: [{
    sender: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
})

const User = mongoose.model('User', userSchema)
const Post = mongoose.model('Post', postSchema)
const Conversation = mongoose.model('Conversation', conversationSchema)


//session middleware
const sessionMiddleware = session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 1000 * 60 * 60
  }
})
Facemash.use(sessionMiddleware)

function isAuthenticated(req, res, next) {
  if (req.session.user) next()
  else res.status(401).send('Unauthorised: You need to login first!')
}

// HTTP server & socket.io setup
const server = http.createServer(Facemash)
const io = socketIo(server, {
  cors: {
    origin: ['http://192.168.1.5:3000', 'http://127.0.0.1:3000', 'http://localhost:3000'],
    credentials: true
  }
})
// share session middleware
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next)
})
// Map to store online users(username->socket.id)
const onlineUsers = {}

io.on('connection', (socket) => {
  const user = socket.request.session.user
  if (!user)
    return socket.disconnect(true)
  onlineUsers[user.uname] = socket.id
  console.log(`${user.uname} connected with socket id ${socket.id}`)

  // listen for dm
  socket.on('private message', async (data) => {
    // expect data:{to:receiver, content}
    const sender = user.uname
    const recipient = data.to
    const messageContent = data.content
    const participants = [sender, recipient].sort()

    try {
      let conversation = await Conversation.findOne({ participants })
      if (!conversation)
        conversation = new Conversation({ participants, messages: [] })
      const newMessage = { sender, content: messageContent, timestamp: new Date() }
      conversation.messages.push(newMessage)
      await conversation.save()
      socket.emit('private message', newMessage)
      // if reciever online, send msg in real time
      if (onlineUsers[recipient]) {
        io.to(onlineUsers[recipient]).emit('private message', newMessage)
      }
    } catch (err) {
      console.error('error handling private message:', err)
      socket.emit('error', 'Failed to send message')
    }
  })

  socket.on('disconnect', () => {
    console.log(`${user.uname} dissconnected`)
    delete onlineUsers[user.uname]
  })
})

// REST Endpoint for fetching convo history
Facemash.get('/conversation/:username', isAuthenticated, async (req, res) => {
  const user1 = req.session.user.uname
  const user2 = req.params.username
  const participants = [user1, user2].sort()
  try {
    const conversation = await Conversation.findOne({ participants })
    if (!conversation)
      return res.json({ messages: [] })
    res.json(conversation)
  } catch (e) {
    console.error('error fetching convo history:', e)
    res.status(500).send('Internal server error')
  }
})

// ////////////////////////

const publicFolder = path.join(__dirname, 'public')
const diskFolder = path.join(__dirname, 'disk')
if (!fs.existsSync(diskFolder))
  fs.mkdirSync(diskFolder)
const dpFolder = path.join(__dirname, 'disk', 'dp')
if (!fs.existsSync(dpFolder))
  fs.mkdirSync(dpFolder)
const picsFolder = path.join(__dirname, 'disk', 'pics')
if (!fs.existsSync(picsFolder))
  fs.mkdirSync(picsFolder)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, dpFolder)
  },
  filename: function (req, file, cb) {

    //delete old dp
    const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    imgExt.forEach(ext => {
      const oldDP = path.join(dpFolder, req.session.user.uname + ext)
      if (fs.existsSync(oldDP))
        fs.unlinkSync(oldDP)
    })
    // save new dp
    const newExt = path.extname(file.originalname)
    cb(null, req.session.user.uname + newExt)
  }
})
const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, picsFolder)
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/'))
    cb(null, true)
  else cb(new Error('Only images allowed!'))
}
const upload = multer({ storage, fileFilter })
const upload2 = multer({ storage: storage2, fileFilter })

//upload dp
Facemash.post('/upload-dp', isAuthenticated, upload.single('dp'), (req, res) => {
  if (!req.file)
    return res.status(400).send('No file received!')
  res.send('Profile picture uploaded successfully!')
})

//fetch dp
Facemash.get('/dp/:uname', isAuthenticated, async (req, res) => {
  const { uname } = req.params
  let filePath = null
  const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  imgExt.forEach(ext => {
    const dp = path.join(dpFolder, uname + ext)
    if (fs.existsSync(dp))
      filePath = dp
  })
  if (!filePath) {
    try {
      const user = await User.findOne({ uname })
      if (user.sex === 'Female')
        filePath = path.join(publicFolder, 'female.jpg')
      else filePath = path.join(publicFolder, 'male.jpg')
    } catch (e) {
      console.error(e)
      filePath = path.join(publicFolder, 'male.jpg')
    }
  }
  res.sendFile(filePath)
})

// fetch post pics
Facemash.get('/pics/:image', isAuthenticated, (req, res) => {
  const { image } = req.params
  res.sendFile(path.join(picsFolder, image))
})

Facemash.get('/session', isAuthenticated, async (req, res) => {

  const currentUser = await User.findOne({ uname: req.session.user.uname })
  res.json({
    uname: currentUser.uname,
    fName: currentUser.fName,
    lName: currentUser.lName,
    friends: currentUser.friends
  })
})


Facemash.post('/login', (req, res) => {
  //matching
  const { uname, pass } = req.body
  User.findOne({
    pass,
    $or: [
      { uname: uname },
      { contact: uname },
      { fName: new RegExp(`^${uname}$`, 'i') }
    ]
  })
    .then(
      user => {
        if (user) {
          req.session.user = { uname: user.uname, fName: user.fName, lName: user.lName, friends: user.friends }
          res.send(`${user.fName} logged in successfully!`)
        }
        else {
          res.status(401).send('Login Failed: invalid credentials!')
        }
      }
    ).catch(e => {
      console.error('Login error:', e)
      res.status(500).send('internal server error')
    })
})

Facemash.post('/signup', (req, res) => {
  const { fName, lName, uname, contact, pass, dob, sex } = req.body
  //check if user already exists
  User.findOne({ uname })
    .then(u => {
      if (u) res.status(400).send('Username already taken!')
      else {
        //creating user
        const newUser = new User({ fName, lName, uname, contact, pass, dob, sex })
        newUser.save()
        res.send('Signup successful')
      }
    })
})

Facemash.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('LogoutError:', err)
      return res.status(500).send('Logout Failed!')
    }
    res.clearCookie('connect.sid');
    res.send('Logout successful!')
  })
})

Facemash.post('/createPost', isAuthenticated, upload2.single('pic'), (req, res) => {
  const { content } = req.body
  if ((!content || content.trim() === '') && !req.file) return res.status(400).send('Post cannot be empty!')
  const newPost = new Post(
    {
      uname: req.session.user.uname,
      fName: req.session.user.fName,
      lName: req.session.user.lName,
      content: content || "",
      image: req.file ? req.file.filename : ""
    }
  )
  newPost.save()
    .then(() => res.send('Post created successfully!'))
})

Facemash.get('/feed', isAuthenticated, async (req, res) => {
  //news feed
  const currentUser = await User.findOne({ uname: req.session.user.uname })
  const posts = await Post.find({ uname: { $in: [currentUser.uname, ...currentUser.friends] } })
    .sort({ createdAt: -1 })
  res.json(posts)
})

Facemash.post('/post-comment', isAuthenticated, async (req, res) => {
  const { _id, commenter, commentContent } = req.body;
  if (!_id || !commenter || !commentContent)
    return res.status(400).send('Comment details are missing!')
  try {
    const post = await Post.findById(_id)
    if (!post)
      return res.status(404).send('Post not found!')

    // inserting the comment
    post.comments.push({ commenter, commentContent })
    await post.save()
    res.send('Comment added successfully!')
  } catch (err) {
    console.error('error posting comment:', err)
    res.status(500).send('Internal server error')
  }
})

Facemash.get('/users/:uname', isAuthenticated, async (req, res) => {
  // Load profile
  const { uname } = req.params;
  try {
    const u = await User.findOne({ uname });
    if (!u) return res.status(404).send('User not found!')
    const posts = await Post.find({ uname }).sort({ createdAt: -1 })
    res.json(
      {
        fName: u.fName,
        lName: u.lName,
        uname: u.uname,
        contact: u.contact,
        dob: u.dob,
        sex: u.sex,
        friends: u.friends,
        posts
      }
    )
  } catch (err) {
    console.error(err)
    res.status(500).send('Server error')
  }
})

Facemash.get('/notifs', isAuthenticated, async (req, res) => {
  const currentUser = await User.findOne({ uname: req.session.user.uname })
  res.json({ friendRequests: currentUser.friendRequests })
})

Facemash.post('/send-friend-req', isAuthenticated, async (req, res) => {
  const { targetUsername } = req.body;
  if (!targetUsername)
    return res.status(400).send('Target username is required!')
  const targetUser = await User.findOne({ uname: targetUsername })
  if (!targetUser)
    return res.status(404).send('User not found!')

  //send req urself not allowed
  if (req.session.user.uname === targetUsername)
    return res.status(400).send("Can't send req to urself!")

  //check already friends
  if (targetUser.friends.includes(req.session.user.uname))
    return res.status(400).send('User already your friend!')

  //check already friend req sent
  if (targetUser.friendRequests.includes(req.session.user.uname))
    return res.status(400).send('Friend Req already sent!')

  //check already friend req received
  const currentUser = await User.findOne({ uname: req.session.user.uname })
  if (currentUser.friendRequests.includes(targetUsername)) {
    fetch('/accept-friend-req', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.cookie
      },
      body: JSON.stringify({ requesterUsername: targetUsername }),
    })
      .then(() => res.send('Friend request already exists, thus accepted!'))
    return;
  }

  targetUser.friendRequests.push(req.session.user.uname)
  await targetUser.save()
  res.send('Friend request sent successfully!')
})

Facemash.post('/accept-friend-req', isAuthenticated, async (req, res) => {
  const { requesterUsername } = req.body;
  if (!requesterUsername)
    return res.status(400).send('Requester username is required!')
  const currentUser = await User.findOne({ uname: req.session.user.uname })
  const requesterUser = await User.findOne({ uname: requesterUsername })
  if (!requesterUser)
    return res.status(404).send('Requester user not found!')

  //check if friend req exist
  if (!currentUser.friendRequests.includes(requesterUsername))
    return res.status(400).send('No friend request found from this user')

  //add friends
  currentUser.friends.push(requesterUsername)
  requesterUser.friends.push(req.session.user.uname)

  //revome req
  currentUser.friendRequests = currentUser.friendRequests.filter(user => user !== requesterUsername)
  await currentUser.save()
  await requesterUser.save()
  res.send('Friend request accepted!')
})

Facemash.post('/reject-friend-req', isAuthenticated, async (req, res) => {
  const { requesterUsername } = req.body
  if (!requesterUsername)
    return res.status(400).send('Requester username is required!')
  const currentUser = await User.findOne({ uname: req.session.user.uname })
  if (!currentUser.friendRequests.includes(requesterUsername))
    return res.status(400).send('No friend req found!')

  currentUser.friendRequests = currentUser.friendRequests.filter(u => u !== requesterUsername)
  await currentUser.save()
  res.send('Friend request Declined!')
})

Facemash.get('/suggestion-box', isAuthenticated, async (req, res) => {
  try {
    const users = await User.find({}, 'uname fName lName')
    res.json(users)
  } catch (err) {
    console.error(err)
    res.status(500).send('server error')
  }
})

Facemash.post('/search', isAuthenticated, async (req, res) => {
  const { query } = req.body
  if (!query || query.trim() === '')
    return res.status(400).send('Query string required!')

  try {
    const searchRegex = new RegExp(query, 'i')
    const users = await User.find({
      $or: [
        { uname: { $regex: searchRegex } },
        { fName: { $regex: searchRegex } },
        { lName: { $regex: searchRegex } },
        { contact: { $regex: searchRegex } }
      ]
    }).select('uname fName lName contact')

    const queryLower = query.toLowerCase()
    const scoredUsers = users.map(user => {
      let score = 0
      const fields = ['fName', 'lName', 'uname', 'contact']
      fields.forEach(field => {
        if (user[field]) {
          const fieldValue = user[field].toLowerCase()
          const pos = fieldValue.indexOf(queryLower)
          if (pos !== -1) {
            const ratio = queryLower.length / fieldValue.length
            const fieldScore = (pos === 0 ? 1 : 1 / (pos + 1)) * ratio
            score = Math.max(score, fieldScore)
          }
        }
      })
      return { user, score }
    })
    scoredUsers.sort((a, b) => b.score - a.score)
    const sortedUsers = scoredUsers.map(item => item.user)
    res.json(sortedUsers)
  } catch (err) {
    console.error('searching error:', err)
    res.status(500).send('server error')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Facemash Server live on port ${port}!`)
})