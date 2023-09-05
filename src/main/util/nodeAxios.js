import axios from "axios"
import httpAdapter from '../../../node_modules/axios/lib/adapters/http';

const instance = axios.create({
    adapter: httpAdapter
});

export default instance