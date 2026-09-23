import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerUser } from '../api/client';

const showGlobalAlert = (title, msg) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${msg}`);
    } else {
        Alert.alert(title, msg);
    }
};

export default function RegisterScreen({ navigation }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('Patient');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            showGlobalAlert("Validation Error", "All fields are required.");
            return;
        }
        if (!email.includes('@')) {
            showGlobalAlert("Validation Error", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            await registerUser(fullName.trim(), email.trim(), password.trim(), role);
            showGlobalAlert('Success', 'Account created! Please log in.');
            navigation.navigate('Login');
        } catch (error) {
            showGlobalAlert('Registration Failed', error.response?.data?.detail || 'An error occurred. Check email formatting.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.logoContainer}>
                    <Ionicons name="git-network-outline" size={36} color="#ffffff" />
                </View>

                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join the DementiaCare network</Text>
                
                <View style={styles.formContainer}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="e.g. Your Full Name" 
                        placeholderTextColor="#94a3b8"
                        value={fullName} 
                        onChangeText={setFullName}
                    />

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
                    
                    <View style={styles.pickerContainer}>
                        <Text style={styles.inputLabel}>Select Your Role</Text>
                        <View style={styles.roleButtons}>
                            {['Patient', 'Caregiver', 'Doctor'].map((r) => (
                                <TouchableOpacity 
                                    key={r}
                                    style={[styles.roleButton, role === r && styles.roleButtonActive]}
                                    onPress={() => setRole(r)}
                                >
                                    <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={[styles.primaryButton, loading && { opacity: 0.7 }]} 
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        <Text style={styles.primaryButtonText}>
                            {loading ? 'REGISTERING...' : 'REGISTER'}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.secondaryButtonText}>Back to Login</Text>
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
        padding: 30, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 12 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 20, 
        elevation: 10,
        alignItems: 'center'
    },
    logoContainer: { 
        width: 60, 
        height: 60, 
        backgroundColor: '#1e293b', 
        borderRadius: 18, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155'
    },
    title: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        color: '#0f172a', 
        textAlign: 'center' 
    },
    subtitle: { 
        fontSize: 13, 
        color: '#64748b', 
        marginBottom: 20, 
        textAlign: 'center',
        marginTop: 2 
    },
    formContainer: { 
        width: '100%' 
    },
    inputLabel: { 
        fontSize: 12, 
        fontWeight: '600', 
        color: '#334155', 
        marginBottom: 5 
    },
    input: { 
        height: 46, 
        backgroundColor: '#f8fafc', 
        borderWidth: 1, 
        borderColor: '#cbd5e1', 
        marginBottom: 14, 
        paddingHorizontal: 14, 
        borderRadius: 10,
        fontSize: 14,
        color: '#0f172a'
    },
    pickerContainer: { 
        marginBottom: 16 
    },
    roleButtons: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        gap: 8,
        marginTop: 4 
    },
    roleButton: { 
        paddingVertical: 10, 
        backgroundColor: '#f1f5f9', 
        borderRadius: 10, 
        flex: 1, 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    roleButtonActive: { 
        backgroundColor: '#2563eb',
        borderColor: '#2563eb'
    },
    roleText: { 
        color: '#475569', 
        fontWeight: '600', 
        fontSize: 13 
    },
    roleTextActive: { 
        color: 'white',
        fontWeight: 'bold'
    },
    primaryButton: { 
        backgroundColor: '#2563eb', 
        paddingVertical: 14, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginBottom: 10, 
        marginTop: 4,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2
    },
    primaryButtonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 14 
    },
    secondaryButton: { 
        backgroundColor: '#f1f5f9', 
        paddingVertical: 12, 
        borderRadius: 12, 
        alignItems: 'center' 
    },
    secondaryButtonText: { 
        color: '#334155', 
        fontWeight: '600', 
        fontSize: 13 
    }
});
