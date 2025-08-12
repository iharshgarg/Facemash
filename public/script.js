window.facemash = window.facemash || {}
facemash.uname = null
facemash.fName = null
facemash.lName = null
facemash.friends = null

const loginForm = document.getElementById('loginForm')
const signupForm = document.getElementById('signupForm')
const createpostForm = document.getElementById('createpostForm')
const textBox = document.getElementById('textBox')
const FeedPosts = document.getElementById('FeedPosts')
const pages = {
    login: document.getElementById('loginPage'),
    feed: document.getElementById('feedPage'),
    profile: document.getElementById('profilePage'),
    navbar: document.querySelector('nav')
};

function loadSession() {
    fetch('/session', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            facemash = data //load facemash data
            document.getElementById('navName').innerText = facemash.fName
            document.getElementById('textBox').placeholder = `What's on your mind, ${facemash.fName}?`
            document.getElementById('navDP').src = '/dp/' + facemash.uname
            populateFriendBox()
            document.getElementById('chatArea').style.display = 'flex'
        })
        .catch(() => console.log('Please Login to load username!'))
}
function loadNotifs() {
    fetch('/notifs', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            const notifList = document.getElementById('notifList')
            notifList.innerHTML = ''//reset old notifs
            if (data.friendRequests.length === 0)
                notifList.innerHTML = '<li>No new friend requests</li>'
            else {
                data.friendRequests.forEach(requester => {
                    const li = document.createElement('li')
                    li.innerHTML = `${requester} sent you a friend request
                <button onclick="acceptFriendReq('${requester}')">Accept</button>
                <button onclick="rejectFriendReq('${requester}')">Decline</button>`
                    notifList.appendChild(li)
                })
            }

        })
}
function loadPostElement(post) {
    const postElement = document.createElement('div')
    postElement.classList.add('post')
    postElement.innerHTML = `
    <div class="postHead">
    <div><img src="/dp/${post.uname}" style="width:40px;height:40px; border-radius:50%;object-fit:cover; margin:10px;margin-left:5vw"/></div>
    <div style='font-size: 20px;margin-left:5px'><strong>${post.fName} ${post.lName}</strong></div>
    </div>
    <div class="commentSection"><p style='margin-top:0'>${post.content}</p></div>

    <div class="postPhotuDiv">
    ${post.image ? `<img class="postPhotu" src="/pics/${post.image}" style=""/>` : ""}
    </div>

        <div class="commentSection">
        <div class="commentList">
            ${post.comments.map(comment => `
                <p><strong>${comment.commenter}:</strong> ${comment.commentContent}</p>
                `).join('')}
        </div>
        <input type="text" class="commentInput" placeholder="Write a comment..."/>
        <button class="commentBtn">Add Comment</button>
    </div>
    <p style="color:gray; font-size:14px; margin-top:30px"><small>${new Date(post.createdAt).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    })}</small></p>

    `
    const commentBtn = postElement.querySelector('.commentBtn')
    const commentInput = postElement.querySelector('.commentInput')
    const commentList = postElement.querySelector('.commentList')

    commentBtn.addEventListener('click', async () => {
        const commentContent = commentInput.value.trim()
        if (!commentContent)
            return
        const commenter = facemash.fName + " " + facemash.lName

        const response = await fetch('/post-comment', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _id: post._id, commenter, commentContent })
        })
        if (response.ok) {
            commentList.innerHTML += `<p><strong>${commenter}:</strong> ${commentContent}</p>`
            commentInput.value = ''
        } else alert('Unable to post comment!')
    })

    commentInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault()
            commentBtn.click()
        }
    })

    return postElement
}
function loadFeed() {
    //news feed
    fetch('/feed', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => res.json())
        .then(posts => {
            FeedPosts.innerHTML = ''
            posts.forEach(post => {
                const postElement = loadPostElement(post)
                FeedPosts.appendChild(postElement)
            })
            loadSuggestionBox()
        })
}
function loadSuggestionBox() {
    fetch('/suggestion-box', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => res.json())
        .then(users => {
            const suggestionBox = document.getElementById('suggestionBox')
            suggestionBox.innerHTML = ''
            suggestionBox.style.display = 'flex'
            suggestionBox.style.overflowX = 'auto'
            suggestionBox.style.padding = '10px'
            suggestionBox.style.border = '1px solid #ccc'
            suggestionBox.style.borderRadius = '10px'
            suggestionBox.style.backgroundColor = '#fff'

            users.reverse().forEach(user => {
                if (user.uname === facemash.uname) return

                const suggestionItem = document.createElement('div')
                suggestionItem.classList.add('suggestionItem')
                suggestionItem.style.display = 'flex'
                suggestionItem.style.flexDirection = 'column'
                suggestionItem.style.alignItems = 'center'
                suggestionItem.style.marginRight = '15px'
                suggestionItem.style.width = '80px'
                suggestionItem.style.cursor = 'pointer'

                const dpImg = document.createElement('img')
                dpImg.src = `/dp/${user.uname}`
                dpImg.style.width = '60px'
                dpImg.style.height = '60px'
                dpImg.style.borderRadius = '50%'
                dpImg.style.objectFit = 'cover'
                dpImg.style.marginBottom = '5px'

                const fullName = document.createElement('span')
                fullName.innerHTML = `<strong>${user.fName} ${user.lName}</strong>`
                fullName.style.fontSize = '12px'
                fullName.style.textAlign = 'center'


                suggestionItem.addEventListener('click', () => loadProfile(user.uname))

                suggestionItem.appendChild(dpImg)
                suggestionItem.appendChild(fullName)
                suggestionBox.appendChild(suggestionItem)
            })
        })
        .catch(err => console.error('err fetching suggestion box:', err))
}

async function loadProfile(uname) {
    if (!uname) {
        console.error('loadProfile function has no uname input')
        return
    }
    fetch(`/users/${uname}`, {
        method: 'GET',
        credentials: 'include'
    })
        .then(r => r.json())
        .then(profile => {
            var pronoun;
            if (profile.sex === 'Male') {
                pronoun = 'He'
            }
            if (profile.sex === 'Female') {
                pronoun = 'She'
            }
            const today = new Date()
            const bday = new Date(profile.dob)
            let age = today.getFullYear() - bday.getFullYear()
            const mdiff = today.getMonth() - bday.getMonth()
            const ddiff = today.getDate() - bday.getDate()
            if (mdiff < 0 || mdiff === 0 && ddiff < 0)
                age--
            document.getElementById('profilePage').innerHTML = `

            <div id='pDpName'>

            <div id='pDp'>
            <img id='dp' src="/dp/${profile.uname}" alt="DP" style="border-radius:50%; object-fit:cover"/>

            <button id="changePhotoBtn" onclick="document.getElementById('DPinput').click()" style='display:none'>Change Photo</button>
            <input type='file' id='DPinput' accept='image/jpeg, image/png' style='display:none' onchange='uploadDP(this.files)'>
            </div>



            <div id='pNameUname'>
            <h3 class='pNameUname'>${profile.fName} ${profile.lName}(${age},${pronoun})</h3>
            <h5 class='pNameUname'>@${profile.uname}</h5>

            <button id="addFriendBtn" onclick="sendFriendReq('${uname}')" style='display:none'>Add Friend</button>
            <p id="friendReqStat"><p>
            </div>

            </div>
            

            

            



            <h4 class='pcontfr'>Contact: ${profile.contact}</h4>
            <h4 class='pcontfr'>Friends: ${profile.friends.join(", ")}</h4>

            <div id="profilePosts"></div>
            `
            if (profile.uname === facemash.uname)
                document.getElementById('changePhotoBtn').style.display = 'block'
            if (profile.uname !== facemash.uname && !profile.friends.includes(facemash.uname))
                document.getElementById('addFriendBtn').style.display = 'block'

            const profilePosts = document.getElementById('profilePosts')
            profilePosts.innerHTML = ''//clear old
            profile.posts.forEach(post => {
                const postElement = loadPostElement(post)
                profilePosts.appendChild(postElement)
            })
            showPage('profile')
        })
}
function uploadDP(files) {
    if (files.length === 0) return
    const file = files[0]
    const formData = new FormData()
    formData.append('dp', file)

    fetch('/upload-dp', {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
        .then(res => res.text())
        .then(data => {
            alert(data)
            const dp = document.getElementById('dp')
            dp.src = dp.src.split('?')[0] + '?' + new Date().getTime()
        })
        .catch(e => {
            console.error('error uploading dp:', e)
        })
}
function showPage(page) {
    //hide all pages
    Object.values(pages).forEach(p => p.style.display = 'none')

    //show only selected page
    pages[page].style.display = 'block'

    //Navbar hidden on login
    pages.navbar.style.display = (page === 'login') ? 'none' : 'block'
}

function sendFriendReq(targetUsername) {
    fetch('/send-friend-req', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUsername })
    })
        .then(res => res.text())
        .then(data =>
            document.getElementById('friendReqStat').innerHTML = data
        )
}
function acceptFriendReq(requesterUsername) {
    fetch('/accept-friend-req', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requesterUsername: requesterUsername })
    })
        .then(res => res.text())
        .then(data => {
            alert(data)
            loadNotifs()
            loadFeed()
            populateFriendBox()
            window.location.reload()
        })
}
function rejectFriendReq(requesterUsername) {
    fetch('/reject-friend-req', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requesterUsername: requesterUsername })
    })
        .then(res => res.text())
        .then(data => {
            alert(data)
            loadNotifs()
        })
}

document.getElementById('logo').addEventListener('click', () => showPage('feed'))
document.getElementById('userBtn').addEventListener('click', () => loadProfile(facemash.uname))
document.getElementById('homeBtn').addEventListener('click', () => showPage('feed'))
document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/logout', {
        method: 'POST',
        credentials: 'include'
    })
        .then(() => {
            Object.keys(facemash).forEach(k => facemash[k] = null)
            document.getElementById('chatArea').style.display = 'none'
            showPage('login')
            window.location.reload()
        })
})

loginForm.addEventListener('submit', e => {
    e.preventDefault()
    const lu = document.getElementById('lu').value.trim()
    const lp = document.getElementById('lp').value
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uname: lu, pass: lp })
    })
        .then(res => {
            if (res.ok) {
                showPage('feed')
                loadSession()
                loadNotifs()
                loadFeed()
                window.location.reload()
                return null
            }
            return res.text()
        })
        .then(e => { if (e) alert(e) })
})
signupForm.addEventListener('submit', e => {
    e.preventDefault()

    const fName = document.getElementById('fName')
    const lName = document.getElementById('lName')
    const su = document.getElementById('su')
    const contact = document.getElementById('contact')
    const sp = document.getElementById('sp')
    const cp = document.getElementById('cp')
    const dob = document.getElementById('dob')
    const sex = document.querySelector('input[name="sex"]:checked')


    if (sp.value !== cp.value) {
        alert('Passwords do not match!')
        sp.value = ''
        cp.value = ''
        sp.focus()
        return;
    }


    //send req to backend
    fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fName: fName.value.trim(),
            lName: lName.value.trim(),
            uname: su.value.trim(),
            contact: contact?.value.trim(),
            pass: sp.value,
            dob: dob?.value,
            sex: sex?.value
        })
    })
        .then(res => {
            if (res.ok)
                signupForm.reset()
            return res.text()
        })
        .then(data => alert(data))
})
createpostForm.addEventListener('submit', e => {
    e.preventDefault()
    const postText = textBox.value.trim()
    const postPhoto = document.getElementById('postPhoto')
    if (!postText && postPhoto.files.length === 0) {
        alert("Post can't be empty!")
        return
    }

    const formData = new FormData()
    formData.append('content', postText)
    if (postPhoto.files.length > 0)
        formData.append('pic', postPhoto.files[0])

    fetch('/createPost', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    })
        .then(res => res.text())
        .then(data => {
            textBox.value = '';
            postPhoto.value = ''
            loadFeed();
        })
        .catch(e => console.error(e))
})
document.getElementById('uploadPhoto').addEventListener('click', function () {
    document.getElementById('postPhoto').click()
})
document.getElementById('postPhoto').addEventListener('change', function () {
    document.getElementById('uploadPhoto').innerText = 'Upload Photo'
    let file = this.files[0];
    if (file)
        document.getElementById('uploadPhoto').innerText = file.name + ' Selected'
})

loadSession()
loadNotifs()
loadFeed()
loadSuggestionBox()
// Page after refresh/reload
fetch('/session', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
        if (data.uname) {
            showPage('feed')
            populateFriendBox()
            loadSession()
            loadNotifs()
            loadFeed()
        } else showPage('login')
    })
    .catch(() => showPage('login'))

// chat
function populateFriendBox() {
    const friendBoxBody = document.getElementById('friendBoxBody')
    friendBoxBody.innerHTML = ''
    if (!facemash.friends || facemash.friends.length === 0) {
        friendBoxBody.innerHTML = '<p>Add friends to chat</p>'
        return
    }
    document.getElementById('friendBoxHead').innerText = `Chat(${facemash.friends.length})`
    facemash.friends.reverse().forEach(friend => {
        const friendDiv = document.createElement('div')
        friendDiv.classList.add('friendDiv')
        friendDiv.style.cursor = 'pointer'


        // dp
        const friendDp = document.createElement('img')
        friendDp.src = `/dp/${friend}`
        friendDp.classList.add('friendDp')
        friendDp.style = 'width:25px;height:25px; border-radius:50%;object-fit:cover;'

        // name
        const friendName = document.createElement('span')
        friendName.textContent = friend
        friendName.classList.add('friendName')

        friendDiv.appendChild(friendDp)
        friendDiv.appendChild(friendName)

        friendDiv.addEventListener('click', () => {
            document.getElementById('chatBoxHead').textContent = friend
            loadDisplayMsgArea(friend)
            document.getElementById('chatBox').style.display = 'flex'
        })
        friendBoxBody.appendChild(friendDiv)
    })
}
function loadDisplayMsgArea(friend) {
    const displayMsgArea = document.getElementById('displayMsgArea')
    displayMsgArea.innerHTML = ''

    fetch(`/conversation/${friend}`, { credentials: 'include' })
        .then(r => r.json())
        .then(conversation => {
            if (!conversation.messages || conversation.messages.length === 0)
                return
            conversation.messages.forEach(msg => {
                const msgDiv = document.createElement('div')
                msgDiv.classList.add('msgDiv')
                if (msg.sender === facemash.uname)
                    msgDiv.style.textAlign = 'right'
                else msgDiv.style.textAlign = 'left'

                msgDiv.textContent = msg.content
                displayMsgArea.appendChild(msgDiv)
                displayMsgArea.scrollTop = displayMsgArea.scrollHeight
            })
        })
        .catch(e => console.error('err fetching convo:', e))
}

const socket = io('', { withCredentials: true })

function appendSocketMsg(msg) {
    const displayMsgArea = document.getElementById('displayMsgArea')
    const msgDiv = document.createElement('div')
    msgDiv.classList.add('msgDiv')

    if (msg.sender === facemash.uname)
        msgDiv.style.textAlign = 'right'
    else msgDiv.textAlign = 'left'

    msgDiv.textContent = msg.content
    displayMsgArea.appendChild(msgDiv)
    displayMsgArea.scrollTop = displayMsgArea.scrollHeight
}

// emit
document.getElementById('sendMsgBtn').addEventListener('click', () => {
    const msgInput = document.getElementById('msgInput')
    const msgInputValue = msgInput.value.trim()
    if (!msgInputValue)
        return
    const friend = document.getElementById('chatBoxHead').textContent.trim()
    if (!friend) {
        console.error('select friend to send msg')
        return
    }
    socket.emit('private message', { to: friend, content: msgInputValue })
    msgInput.value = ''
})

document.getElementById('msgInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault()
        document.getElementById('sendMsgBtn').click()
    }
})

// listen
socket.on('private message', msg => {
    const currentChatFriend = document.getElementById('chatBoxHead').textContent
    if (msg.sender === facemash.uname || msg.sender === currentChatFriend)
        appendSocketMsg(msg)
})


// maximizing fbox
document.getElementById('friendBoxHead').addEventListener('click', () => {
    document.getElementById('friendBoxBody').style.display = 'block'
    document.getElementById('minimizeFriendBoxBtn').style.display = 'block'
    document.getElementById('friendBoxHead').style.cursor = ''
    document.getElementById('friendBoxHead').style.backgroundColor = ' #3b5998'
    document.getElementById('friendBoxHeadWrap').style.backgroundColor = ' #3b5998'
    document.getElementById('friendBoxHead').style.color = 'white'
})
// minimizing fbox
document.getElementById('minimizeFriendBoxBtn').addEventListener('click', () => {
    document.getElementById('friendBoxBody').style.display = 'none'
    document.getElementById('minimizeFriendBoxBtn').style.display = 'none'
    document.getElementById('friendBoxHead').style.cursor = 'pointer'
    document.getElementById('friendBoxHead').style.backgroundColor = 'rgb(236,239,243)'
    document.getElementById('friendBoxHeadWrap').style.backgroundColor = 'rgb(236,239,243)'
    document.getElementById('friendBoxHead').style.color = ''
})
document.getElementById('closeChatBoxBtn').addEventListener('click', () => {
    document.getElementById('chatBox').style.display = 'none'
})


// search
function searchUsers() {
    const query = document.getElementById('searchBar').value.trim()
    const searchResultsDiv = document.getElementById('searchResults')
    if (!query) {
        searchResultsDiv.innerHTML = ''
        return
    }

    console.log(query)
    fetch('/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    })
        .then(res => res.json())
        .then(users => {
            searchResultsDiv.innerHTML = ''

            if (users.length === 0) {
                const noResults = document.createElement('div')
                noResults.classList.add('noResults')
                noResults.textContent = 'No users found'
                noResults.classList.add('noResults')
                searchResultsDiv.appendChild(noResults)
                document.getElementById('searchResults').style.display = 'block'
                return
            }

            users.forEach(user => {
                const matchingUserDiv = document.createElement('div')
                matchingUserDiv.classList.add('matchingUser')

                matchingUserDiv.addEventListener('click', () => {
                    loadProfile(user.uname)
                    document.getElementById('searchResults').style.display = 'none'
                })

                const searchUserDp = document.createElement('img')
                searchUserDp.classList.add('searchUserDp')
                searchUserDp.src = `/dp/${user.uname}`

                const searchUserName = document.createElement('span')
                searchUserName.textContent = `${user.fName} ${user.lName}`

                matchingUserDiv.appendChild(searchUserDp)
                matchingUserDiv.appendChild(searchUserName)
                searchResultsDiv.appendChild(matchingUserDiv)
            })
            document.getElementById('searchResults').style.display = 'block'
        })
        .catch(e => console.error('err fetching search results:', e))
}

document.addEventListener('click', function (e) {
    const searchBarAndList = document.getElementById('searchBarAndList')
    const searchResults = document.getElementById('searchResults')
    if (!searchBarAndList.contains(e.target))
        if (searchResults.style.display !== 'none')
            searchResults.style.display = 'none'
})

//realtime search
document.getElementById("searchBar").addEventListener('input', function () {
    searchUsers()
})

// about
document.getElementById('foot').addEventListener('click', () => {
    document.getElementById('aboutBox').style.display = 'block'
})

document.getElementById('closeAbout').addEventListener('click', () => {
    document.getElementById('aboutBox').style.display = 'none'
})


///heartbeat for safari
setInterval(() => {
    fetch('/heartbeat?ts=' + new Date().getTime(),{method: 'GET'})
    .catch(err=>console.error('Heartbeat err:',err))
}, 20000);


// beta testing for adsense approval - automatically login

fetch('/session', { method: 'GET', credentials: 'include' })
    .then(res => res.json())
    .then(session => {
        if (!session.uname) {
            fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ uname: "beta", pass: "beta" })
            })
                .then(res => {
                    console.log('beta code running')
                    window.location.reload()
                })
                .then(e => { if (e) alert(e) })
        }
    })