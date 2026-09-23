import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { login, getUserRole } from '../api/client';

const showGlobalAlert = (title, msg) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${msg}`);
    } else {
        Alert.alert(title, msg);
    }
};

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            showGlobalAlert('Missing Information', 'Please enter your email and password.');
            return;
        }

        setLoading(true);
        try {
            await login(email.trim(), password.trim());
            const user = await getUserRole();
            
            showGlobalAlert('✅ Welcome!', `Welcome back, ${user.full_name}!`);
            
            if (user.role === 'Caregiver') {
                navigation.replace('CaregiverDashboard');
            } else if (user.role === 'Doctor') {
                navigation.replace('DoctorDashboard');
            } else {
                navigation.replace('PatientDashboard');
            }
        } catch (error) {
            showGlobalAlert('Login Failed', error.response?.data?.detail || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.logoContainer}>
                    <Ionicons name="git-network-outline" size={44} color="#ffffff" />
                </View>

                <Text style={styles.title}>DementiaCare</Text>
                <Text style={styles.subtitle}>Care • Connect • Support</Text>
                
                <View style={styles.formContainer}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. user@dementiacare.org"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <Text style={styles.inputLabel}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    
                    <TouchableOpacity 
                        style={[styles.primaryButton, loading && { opacity: 0.7 }]} 
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        <Text style={styles.primaryButtonText}>
                            {loading ? 'AUTHENTICATING...' : 'LOG IN'}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.secondaryButton} 
                        onPress={() => navigation.navigate('Register')}
                    >
                        <Text style={styles.secondaryButtonText}>Create New Account</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#0f172a',
        padding: 20 
    },
    card: {
        width: '100%', 
        maxWidth: 440, 
        backgroundColor: '#ffffff', 
        borderRadius: 24,
        padding: 32, 
        alignItems: 'center', 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 12 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 20, 
        elevation: 10
    },
    logoContainer: { 
        width: 72, 
        height: 72, 
        backgroundColor: '#1e293b', 
        borderRadius: 20, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#334155'
    },
    title: { 
        fontSize: 26, 
        fontWeight: 'bold', 
        color: '#0f172a', 
        textAlign: 'center' 
    },
    subtitle: { 
        fontSize: 13, 
        color: '#64748b', 
        marginBottom: 24, 
        fontWeight: '500', 
        textAlign: 'center', 
        marginTop: 2 
    },
    formContainer: { 
        width: '100%' 
    },
    inputLabel: { 
        fontSize: 13, 
        fontWeight: '600', 
        color: '#334155', 
        marginBottom: 6 
    },
    input: {
        height: 48, 
        backgroundColor: '#f8fafc', 
        borderWidth: 1, 
        borderColor: '#cbd5e1',
        marginBottom: 16, 
        paddingHorizontal: 16, 
        borderRadius: 12, 
        fontSize: 15, 
        color: '#0f172a'
    },
    primaryButton: { 
        backgroundColor: '#2563eb', 
        paddingVertical: 14, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginBottom: 12, 
        marginTop: 6,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2
    },
    primaryButtonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 15, 
        letterSpacing: 0.5 
    },
    secondaryButton: { 
        backgroundColor: '#f1f5f9', 
        paddingVertical: 13, 
        borderRadius: 12, 
        alignItems: 'center' 
    },
    secondaryButtonText: { 
        color: '#334155', 
        fontWeight: '600', 
        fontSize: 14 
    }
});
