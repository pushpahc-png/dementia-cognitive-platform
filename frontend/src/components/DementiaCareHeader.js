import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../api/client';

export default function DementiaCareHeader({
    user,
    role = 'Patient',
    themeColor = '#1e293b',
    onNavigate,
    navigation
}) {
    const [dropdownVisible, setDropdownVisible] = useState(false);

    const userName = user?.full_name || (
        role === 'Doctor' ? 'Doctor' :
        role === 'Caregiver' ? 'Caregiver' : 'Patient'
    );

    const displayRole = role || 'Patient';

    const handleLogout = async () => {
        setDropdownVisible(false);
        try {
            await logout();
        } catch (e) {
            console.log('Logout error', e);
        }
        if (navigation) {
            navigation.replace('Login');
        }
    };

    return (
        <View style={[styles.headerContainer, { backgroundColor: themeColor }]}>
            {/* Left: DementiaCare Brand Logo */}
            <TouchableOpacity 
                style={styles.brandRow}
                activeOpacity={0.8}
                onPress={() => onNavigate && onNavigate('Home')}
            >
                <View style={styles.brainIconBox}>
                    <Ionicons name="git-network-outline" size={26} color="white" />
                </View>
                <View style={styles.brandTextCol}>
                    <Text style={styles.brandTitle}>DementiaCare</Text>
                    <Text style={styles.brandSubtitle}>Care • Connect • Support</Text>
                </View>
            </TouchableOpacity>

            {/* Right: User Profile Chip with Dropdown */}
            <TouchableOpacity 
                style={styles.profileChip}
                activeOpacity={0.8}
                onPress={() => setDropdownVisible(!dropdownVisible)}
            >
                <View style={styles.avatarCircle}>
                    {role === 'Doctor' ? (
                        <Ionicons name="person-circle" size={36} color="#60a5fa" />
                    ) : role === 'Caregiver' ? (
                        <Ionicons name="person-circle" size={36} color="#34d399" />
                    ) : (
                        <Ionicons name="person-circle" size={36} color="#93c5fd" />
                    )}
                </View>

                <View style={styles.userTextCol}>
                    <Text style={styles.userNameText} numberOfLines={1}>{userName}</Text>
                    <Text style={styles.userRoleText}>{displayRole}</Text>
                </View>

                <Ionicons 
                    name={dropdownVisible ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="rgba(255,255,255,0.8)" 
                    style={{ marginLeft: 4 }}
                />
            </TouchableOpacity>

            {/* Profile Dropdown Modal */}
            {dropdownVisible && (
                <Modal transparent animationType="fade" visible={dropdownVisible} onRequestClose={() => setDropdownVisible(false)}>
                    <TouchableOpacity 
                        style={styles.modalBackdrop} 
                        activeOpacity={1} 
                        onPress={() => setDropdownVisible(false)}
                    >
                        <View style={[styles.dropdownMenu, { top: Platform.OS === 'web' ? 68 : 90 }]}>
                            <View style={styles.dropdownHeader}>
                                <Text style={styles.dropdownName}>{userName}</Text>
                                <Text style={styles.dropdownRole}>{displayRole} Account</Text>
                                {user?.email ? <Text style={styles.dropdownEmail}>{user.email}</Text> : null}
                            </View>

                            <View style={styles.divider} />

                            <TouchableOpacity 
                                style={styles.dropdownItem}
                                onPress={() => {
                                    setDropdownVisible(false);
                                    if (navigation) navigation.navigate('Settings');
                                }}
                            >
                                <Ionicons name="settings-outline" size={18} color="#475569" />
                                <Text style={styles.dropdownItemText}>Account Settings</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.dropdownItem, { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }]}
                                onPress={handleLogout}
                            >
                                <Ionicons name="log-out-outline" size={18} color="#dc2626" />
                                <Text style={[styles.dropdownItemText, { color: '#dc2626', fontWeight: 'bold' }]}>
                                    Sign Out
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        width: '100%',
        height: 70,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    brainIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)'
    },
    brandTextCol: {
        justifyContent: 'center'
    },
    brandTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.3
    },
    brandSubtitle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.4
    },
    profileChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 24,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)'
    },
    avatarCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)'
    },
    userTextCol: {
        alignItems: 'flex-start'
    },
    userNameText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold'
    },
    userRoleText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 11,
        fontWeight: '500'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.25)'
    },
    dropdownMenu: {
        position: 'absolute',
        right: 20,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: 220,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    dropdownHeader: {
        padding: 16,
        backgroundColor: '#f8fafc',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16
    },
    dropdownName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    dropdownRole: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0284c7',
        marginTop: 2
    },
    dropdownEmail: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9'
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#334155'
    }
});
