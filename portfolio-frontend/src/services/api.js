import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:8000";

// Create an axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
});

// Automatically attach JWT token to headers if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Auth APIs
export const loginUser = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await axios.post(`${API_BASE_URL}/token`, formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("token", response.data.access_token);
    return response.data;
};

export const signupUser = async (email, password) => {
    const response = await axios.post(`${API_BASE_URL}/signup`, { email, password });
    return response.data;
};

export const logoutUser = () => {
    localStorage.removeItem("token");
};

// Portfolio APIs (Secured with token via interceptor)
export const getPortfolio = async () => {
    const response = await api.get('/portfolio/');
    return response.data;
};

export const addStock = async (stockData) => {
    const response = await api.post('/portfolio/', stockData);
    return response.data;
};

export const deleteStock = async (stockId) => {
    const response = await api.delete(`/portfolio/${stockId}`);
    return response.data;
};