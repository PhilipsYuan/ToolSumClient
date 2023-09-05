import axios from "axios"
// import httpAdapter from 'axios/lib/adapters/http.js';

// axios.getDef

const instance = axios.create({
    adapter: ["http"]
});

export default instance