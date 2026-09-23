import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = Platform.OS === 'web' 
    ? 'http://localhost:8000/api/v1' 
    : 'http://10.201.0.156:8000/api/v1'; 

const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let memoryToken = null;

const storeToken = async (token) => {
    memoryToken = token;
    if (Platform.OS === 'web') {
        localStorage.setItem('userToken', token);
    } else {
        await SecureStore.setItemAsync('userToken', token);
    }
};

const getToken = async () => {
    if (memoryToken) return memoryToken;
    if (Platform.OS === 'web') {
        memoryToken = localStorage.getItem('userToken');
    } else {
        try {
            memoryToken = await SecureStore.getItemAsync('userToken');
        } catch (e) {
            console.log("SecureStore Error:", e);
        }
    }
    return memoryToken;
};

const removeToken = async () => {
    memoryToken = null;
    if (Platform.OS === 'web') {
        localStorage.removeItem('userToken');
    } else {
        try {
            await SecureStore.deleteItemAsync('userToken');
        } catch (e) {
            console.log("SecureStore Error:", e);
        }
    }
};

client.interceptors.request.use(async (config) => {
    let token = await getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await client.post('/login', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    await storeToken(response.data.access_token);
    return response.data;
};

export const registerUser = async (fullName, email, password, role) => {
    const response = await client.post('/register', {
        full_name: fullName,
        email,
        password,
        role,
    });
    return response.data;
};

export const getUserRole = async () => {
    const response = await client.get('/me');
    return response.data;
};

export const getUserById = async (userId) => {
    const response = await client.get(`/users/${userId}`);
    return response.data;
};

export const logout = async () => {
    await removeToken();
};

export const fetchReminders = async () => {
    const response = await client.get('/get-reminders');
    return response.data;
};

export const fetchAlerts = async () => {
    const response = await client.get('/alerts');
    return response.data;
};

export const deleteAlert = async (alertId) => {
    const response = await client.delete(`/alerts/${alertId}`);
    return response.data;
};

export const triggerPanicAlert = async () => {
    const response = await client.post('/panic-alert', {
        alert_type: "Panic",
        description: "Emergency triggered from app"
    });
    return response.data;
};

export const predictRisk = async (patientId) => {
    const response = await client.get(`/predict-risk/${patientId}`);
    return response.data;
};

export const fetchMemoryGraph = async (patientId) => {
    const response = await client.get(`/memory-graph/${patientId}`);
    return response.data;
};

export const analyzeSpeechCognitive = async (speechText) => {
    const response = await client.post('/analyze-speech-cognitive', { speech_text: speechText });
    return response.data;
};

export const fetchCaregiverDailySummary = async (patientId) => {
    const response = await client.get(`/caregiver-daily-summary/${patientId}`);
    return response.data;
};

export const addReminder = async (title, timeStr) => {
    const response = await client.post('/add-reminder', {
        title,
        description: "",
        time: timeStr
    });
    return response.data;
};

export const completeReminder = async (reminderId) => {
    const response = await client.put(`/complete-reminder/${reminderId}`);
    return response.data;
};

export const updateReminder = async (reminderId, title, time) => {
    const response = await client.put(`/update-reminder/${reminderId}`, { title, time, is_completed: false });
    return response.data;
};

export const deleteReminder = async (reminderId) => {
    const response = await client.delete(`/delete-reminder/${reminderId}`);
    return response.data;
};

export const missReminder = async (reminderId) => {
    const response = await client.put(`/miss-reminder/${reminderId}`);
    return response.data;
};

export const scanFace = async (base64Image) => {
    const response = await client.post('/recognize-face', {
        image_base64: base64Image
    });
    return response.data;
};

export const checkInLocation = async (lat, lng) => {
    const response = await client.post('/location-update', {
        latitude: lat,
        longitude: lng
    });
    return response.data;
};

export const analyzeBehavior = async () => {
    const response = await client.post('/analyze-pattern');
    return response.data;
};

export const fetchNotes = async () => {
    const res = await client.get('/notes');
    return res.data;
};

export const parseUTC = (dateString) => {
    if (!dateString) return new Date();
    return new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
};

export const addNote = async (title, content) => {
    const res = await client.post('/notes', { title, content });
    return res.data;
};

export const fetchContacts = async () => {
    const res = await client.get('/contacts');
    return res.data;
};

export const addContact = async (name, phone) => {
    const res = await client.post('/contacts', { name, phone });
    return res.data;
};

export const fetchPhotos = async () => {
    const res = await client.get('/photos');
    return res.data;
};

export const addPhoto = async (title, url) => {
    const res = await client.post('/photos', { title, description: "", image_url: url });
    return res.data;
};

export const deletePhoto = async (photoId) => {
    const res = await client.delete(`/photos/${photoId}`);
    return res.data;
};

export const fetchPatients = async () => {
    const response = await client.get('/patients');
    return response.data;
};

export const fetchConversation = async (otherUserId) => {
    const response = await client.get(`/messages/${otherUserId}`);
    return response.data;
};

export const sendMessage = async (receiverId, content) => {
    const response = await client.post('/messages', {
        receiver_id: receiverId,
        content,
    });
    return response.data;
};

export const fetchPatientLocation = async (patientId) => {
    const response = await client.get(`/patient-location/${patientId}`);
    return response.data;
};

export const linkPatientByEmail = async (email, caregiverEmail = null) => {
    let url = `/link-patient-by-email?email=${encodeURIComponent(email)}`;
    if (caregiverEmail) {
        url += `&caregiver_email=${encodeURIComponent(caregiverEmail)}`;
    }
    const response = await client.post(url);
    return response.data;
};

export const assignCaregiverToPatient = async (patientId, caregiverEmail) => {
    const response = await client.post(`/assign-caregiver?patient_id=${patientId}&caregiver_email=${encodeURIComponent(caregiverEmail)}`);
    return response.data;
};

export const fetchCaregivers = async () => {
    const response = await client.get('/caregivers');
    return response.data;
};

export default client;
