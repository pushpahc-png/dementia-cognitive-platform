import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logout, getUserRole } from '../api/client';

export default function SettingsScreen({ navigation }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        getUserRole().then(setUser).catch(() => {});
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            console.log(e);
        }
        navigation.replace('Login');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarLarge}>
                        <Ionicons name="person" size={40} color="#2563eb" />
                    </View>
                    <Text style={styles.profileName}>{user?.full_name || 'User Profile'}</Text>
                    <Text style={styles.profileRole}>{user?.role || 'Patient'} Account</Text>
                    {user?.email && <Text style={styles.profileEmail}>{user.email}</Text>}
                </View>

                <View style={styles.settingsSection}>
                    <TouchableOpacity 
                        style={styles.settingItem}
                        onPress={() => navigation.navigate('Medication')}
                    >
                        <Ionicons name="medical-outline" size={22} color="#2563eb" />
                        <Text style={styles.settingText}>Medication Schedule</Text>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.settingItem}
                        onPress={() => navigation.navigate('Contacts')}
                    >
                        <Ionicons name="people-outline" size={22} color="#16a34a" />
                        <Text style={styles.settingText}>Care Network & Contacts</Text>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.settingItem, styles.logoutItem]}
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={22} color="#dc2626" />
                        <Text style={[styles.settingText, { color: '#dc2626', fontWeight: 'bold' }]}>
                            Sign Out
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color="#dc2626" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    header: {
        height: 64,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0'
    },
    backBtn: {
        padding: 8
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    content: {
        padding: 24,
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center'
    },
    profileCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    profileRole: {
        fontSize: 13,
        color: '#2563eb',
        fontWeight: '600',
        marginTop: 2
    },
    profileEmail: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4
    },
    settingsSection: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden'
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        gap: 12
    },
    settingText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b'
    },
    logoutItem: {
        borderBottomWidth: 0
    }
});
