import React, { useEffect, useState } from 'react'
import './App.css';
import { ConnectionManager } from './ConnectionManager';
import { socket } from './socket';
import axios from 'axios'
import Countdown from 'react-countdown'


const updateDoc = (text) => {
  return axios.post(`${process.env.REACT_APP_API_ADDRESS}/set`, {
    url: text
  })
}

const getDoc = () => {
  return axios.get(`${process.env.REACT_APP_API_ADDRESS}/document`)
}

const App = () => {

  const [isConnected, setIsConnected] = useState(socket.isConnected);
  const [localChange, setLocalChange] = useState(false)
  const [document, setDocument] = useState("a bunch of text like this".split(' '))
  const [expiresTime, setExpiresTime] = useState()
  const [expired, setExpired] = useState(false)
  const [docSub, setDocSub] = useState('')

  const handleUpdateDoc = async () => {
    const res = await updateDoc(docSub)
    if (res.status === 200) {
      const { document, expires } = res.data
      setDocument(document)
      setExpiresTime(new Date(expires))
    }
  }

  useEffect(() => {
    getDoc().then(res => {
      if (res.status === 200) {
        const { document, expires }= res.data
        setDocument(document)
        setExpiresTime(new Date(expires))
        setExpired(new Date() > new Date(expires))
      }
    })
  }, [])

  useEffect(() => {
    if (localChange) {
      socket.emit('documentUpdate', document);
      setLocalChange(false)
    }
  }, [document])
  
  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
    }

    function onEvent(value) {
      setDocument(value)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('document', onEvent)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('document', onEvent)
    }
  }, [])

/*
Alternative ideas:
  1. Some percentage are assigned as "savers" who instead mark words to keep
  2. Each person gets X (3, 5, 10?) words to mark for keep in addition to deletion
  3. People only get to mark X words for keep, and the computer continuously deletes words until all that's left is whats kept by users
  4. make all these things (+ expires times, source, etc, # keeprs, # removes, or what is enabled/disabled etc) configurable and people will spin up "Spaces" with their settings (and maybe link per poem space generated?)
*/ 

  return (
    <div className="App">
      <div style={{ overflowWrap: true, textAlign: 'justify' }}>
      {document.map((word, i) => (<span onClick={() => {
        if (!expired) {
          setLocalChange(true)
          setDocument(d => d.filter((_, idx) => i !== idx))
        }
      }}>{word} </span>))}
      </div>
      <br/><br/>
      <input onChange={e => setDocSub(e.target.value)} disabled={!expired}></input>
      <br/>
      <button onClick={handleUpdateDoc} disabled={!expired}>Submit Document</button>
      <div>
        {
          expiresTime && !expired ? (
            <span>Expires in <Countdown date={expiresTime} onComplete={() => setExpired(true)} /></span>
          ) : (
            <span>The timer has expired! This poem is complete. Anyone is welcome to submit a document now for the next poem.</span>
          )
        }
      </div>
      <br/><br/>
      <div><span>Connection Status: {isConnected ? 'connected' : 'disconnected'}</span></div>
      <ConnectionManager/>
    </div>
);
}

export default App;
