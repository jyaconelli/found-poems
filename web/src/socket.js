import { io } from 'socket.io-client'

const URL = process.env.REACT_APP_NODE_ENV === 'production' ? `${process.env.REACT_APP_API_ADDRESS}:3000` : 'http://10.0.0.43:3000';

export const socket = io(URL)