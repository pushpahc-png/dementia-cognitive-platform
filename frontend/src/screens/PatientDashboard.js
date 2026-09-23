import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Platform, Modal, Animated, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DementiaCareHeader from '../components/DementiaCareHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import {
    fetchReminders,
    triggerPanicAlert,
    completeReminder,
    missReminder,
    checkInLocation,
    getUserRole,
    parseUTC
} from '../api/client';

const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
    } else {
        const { Alert } = require('react-native');
        Alert.alert(title, message);
    }
};

const speak = (text, onEnd) => {
    if (Platform.OS !== 'web' || !window.speechSynthesis) {
        onEnd && onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    const utt = new window.SpeechSynthesisUtterance(text);
    utt.lang = 'en-IN';
    utt.rate = 0.9;
    utt.pitch = 1.05;
    utt.volume = 1;
    utt.onend = () => onEnd && onEnd();
    window.speechSynthesis.speak(utt);
};

export default function PatientDashboard({ navigation }) {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [activeTab, setActiveTab]             = useState('home');
    const [reminders, setReminders]             = useState([]);
    const [currentUser, setCurrentUser]         = useState(null);
    const [locationShared, setLocationShared]   = useState(false);

    // Voice assistant & Memory Help Modal
    const [voiceModal, setVoiceModal]           = useState(false);
    const [activeReminder, setActiveReminder]   = useState(null);
    const [voiceState, setVoiceState]           = useState('idle');
    const [voiceTitle, setVoiceTitle]           = useState('');
    const [companionText, setCompanionText]     = useState('');

    // Object Memory Finder Modal ("Where did I put it?")
    const [objectModal, setObjectModal]         = useState(false);

    // Mini Memory Training Game Modal
    const [gameModal, setGameModal]             = useState(false);

    const pulseAnim  = useRef(new Animated.Value(1)).current;
    const checkedIds = useRef(new Set());

    const OBJECT_LOGS = [
        { name: 'Glasses / Spectacles', lastSeen: 'Bedside Nightstand', time: '8:30 AM' },
        { name: 'House Keys', lastSeen: 'Front Entrance Key Hook', time: '9:15 AM' },
        { name: 'Walking Stick', lastSeen: 'Living Room Armchair', time: '10:00 AM' },
        { name: 'Wallet / Purse', lastSeen: 'Bedroom Closet Shelf', time: 'Yesterday 6:00 PM' }
    ];

    useEffect(() => {
        if (voiceState === 'listening') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [voiceState]);

    useEffect(() => {
        loadDashboard();
        autoTrackLocation();
    }, []);

    useEffect(() => {
        const interval = setInterval(checkForDueMedications, 30000);
        return () => clearInterval(interval);
    }, [reminders]);

    const autoTrackLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const { coords } = await Location.getCurrentPositionAsync({});
                await checkInLocation(coords.latitude, coords.longitude);
                setLocationShared(true);
            }
        } catch (e) {
            console.log('Auto location tracking fallback', e);
        }
    };

    const loadDashboard = async () => {
        try {
            const [user, data] = await Promise.all([getUserRole(), fetchReminders()]);
            setCurrentUser(user);
            setReminders(data);
        } catch (err) {
            console.error('Failed to load patient dashboard:', err);
        }
    };

    const checkForDueMedications = () => {
        const now = new Date();
        for (const rem of reminders) {
            if (rem.is_completed) continue;
            if (checkedIds.current.has(rem.id)) continue;
            const dueTime = parseUTC(rem.time);
            const diffMs  = now - dueTime;
            if (diffMs >= 0 && diffMs <= 3 * 60 * 1000) {
                checkedIds.current.add(rem.id);
                triggerVoiceReminder(rem);
                break;
            }
        }
    };

    const triggerVoiceReminder = (reminder) => {
        setActiveReminder(reminder);
        setVoiceModal(true);
        setVoiceState('speaking');
        const parts = reminder.title.split(' - ');
        const medName = parts.slice(1).join(' - ') || reminder.title;
        const announcement = `Hello! It is time to take your ${medName}. Please take your medicine now. Say "Taken" or press the Taken button when done.`;
        setVoiceTitle(`🔔 Time for: ${medName}`);
        setCompanionText(announcement);

        speak(announcement, () => {
            setVoiceState('listening');
        });
    };

    // 3 DISTINCT COGNITIVE QUESTIONS & REASSURANCES
    const handleWhereAmI = () => {
        const text = `You are safe at home in your residence, ${currentUser?.full_name || 'there'}. Your home safe zone is active, and your care network is watching over you.`;
        setVoiceTitle("📍 Where am I?");
        setCompanionText(text);
        setVoiceModal(true);
        setVoiceState('speaking');
        speak(text, () => setVoiceState('idle'));
    };

    const handleWhatShouldIDo = () => {
        const nextMed = reminders.find(r => !r.is_completed);
        const medText = nextMed ? `Your next task is to take your ${nextMed.title.split(' - ').slice(1).join(' - ') || nextMed.title}.` : 'You have completed all your tasks for now. You can relax!';
        const text = `Right now, take your time. ${medText} Your daughter Spandana is always watching out for you.`;
        setVoiceTitle("📋 What should I do?");
        setCompanionText(text);
        setVoiceModal(true);
        setVoiceState('speaking');
        speak(text, () => setVoiceState('idle'));
    };

    const handleWhoIsHelpingMe = () => {
        const text = `Your loving daughter Spandana set up this helper for you. Caregiver Lakshmi and your doctor are also here to support you at any time.`;
        setVoiceTitle("👥 Who is helping me?");
        setCompanionText(text);
        setVoiceModal(true);
        setVoiceState('speaking');
        speak(text, () => setVoiceState('idle'));
    };

    const handleVoiceConfirm = async (id, taken) => {
        try {
            if (taken) {
                await completeReminder(id);
                setVoiceState('success');
                setVoiceTitle('✅ Great job! Marked as taken.');
                speak('Wonderful! Marked as taken.', () => {
                    setTimeout(() => closeVoiceModal(), 1800);
                });
            } else {
                await missReminder(id);
                setVoiceState('success');
                setVoiceTitle('⚠️ Logged as missed.');
                speak('Logged. Caregiver has been notified.', () => {
                    setTimeout(() => closeVoiceModal(), 1800);
                });
            }
            loadDashboard();
        } catch {
            setVoiceState('error');
            setVoiceTitle('Could not update. Please try again.');
        }
    };

    const handleMarkNextMedTaken = async (med) => {
        if (!med) return;
        try {
            await completeReminder(med.id);
            speak(`Great job! ${med.title} marked as taken.`);
            showAlert('✅ Medication Taken', `Wonderful job! ${med.title} has been logged as taken.`);
            loadDashboard();
        } catch (e) {
            showAlert('Update', 'Marked medication as taken.');
            loadDashboard();
        }
    };

    const closeVoiceModal = () => {
        window.speechSynthesis && window.speechSynthesis.cancel();
        setVoiceModal(false);
        setVoiceState('idle');
        setActiveReminder(null);
        setVoiceTitle('');
        setCompanionText('');
    };

    const handlePanic = async () => {
        try {
            await triggerPanicAlert();
            speak("Emergency alert sent! Your daughter Spandana and caregiver have been notified.");
            showAlert('🚨 SOS Alert Dispatched', `Your daughter Spandana and caregiver have been notified immediately! Help is on the way.`);
        } catch {
            showAlert('Emergency', 'Emergency signal dispatched to your care network.');
        }
    };

    const handleSidebarSelect = (key) => {
        // Only 'home' has inline dashboard content
        if (key === 'home') {
            setActiveTab(key);
        }
        // Tabs that navigate away or open modals — do NOT change activeTab
        if (key === 'medications') {
            navigation.navigate('Medication');
        } else if (key === 'location') {
            handleWhereAmI(); // opens the voice/modal overlay, stays on home
        } else if (key === 'messages') {
            navigation.navigate('Contacts');
        } else if (key === 'settings') {
            navigation.navigate('Settings');
        }
    };

    const patientNavItems = [
        { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
        { key: 'medications', label: 'Medications', icon: 'medical-outline', activeIcon: 'medical' },
        { key: 'location', label: 'Location', icon: 'location-outline', activeIcon: 'location' },
        { key: 'messages', label: 'Messages', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
        { key: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
    ];

    // Find next pending medication — purely from live API data
    const nextPendingMed = reminders.find(r => !r.is_completed) || null;
    const nextMedTitle = nextPendingMed ? (nextPendingMed.title.split(' - ')[0] || nextPendingMed.title) : null;
    const nextMedCategory = nextPendingMed ? (nextPendingMed.title.split(' - ')[1] || 'Medication') : null;
    const nextMedTime = nextPendingMed ? (() => {
        try {
            const d = parseUTC(nextPendingMed.time);
            return `Today • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch { return nextPendingMed.time || 'Scheduled'; }
    })() : null;

    const patientName = currentUser?.full_name || '';

    return (
        <View style={styles.rootContainer}>
            {/* Top Navigation Header */}
            <DementiaCareHeader 
                user={currentUser} 
                role="Patient" 
                themeColor="#1e293b" 
                navigation={navigation}
            />

            <View style={styles.bodyLayout}>
                {/* Left Sidebar (Desktop / Tablet) */}
                {isDesktop && (
                    <DashboardSidebar 
                        items={patientNavItems} 
                        activeKey={activeTab} 
                        onSelect={handleSidebarSelect}
                        activeColor="#2563eb"
                        activeBg="#dbeafe"
                    />
                )}

                {/* Main Content Dashboard */}
                <ScrollView 
                    style={styles.mainCanvas} 
                    contentContainerStyle={styles.canvasContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Greeting Banner */}
                    <View style={styles.greetingSection}>
                        <View style={styles.greetingHeaderRow}>
                            <Text style={styles.sunIcon}>☀️</Text>
                            <Text style={styles.greetingTitle}>
                                Good morning, {patientName} <Text style={styles.smiley}>😊</Text>
                            </Text>
                        </View>
                        <Text style={styles.greetingSubtitle}>
                            You are safe. Take your time. We are here for you.
                        </Text>
                    </View>

                    {/* Trust Anchor Banner */}
                    <TouchableOpacity 
                        style={styles.trustAnchorCard} 
                        activeOpacity={0.85}
                        onPress={() => {
                            speak("Your daughter Spandana set up this helper so you always feel safe and supported.");
                        }}
                    >
                        <View style={styles.trustHeartCircle}>
                            <Ionicons name="heart" size={26} color="#ffffff" />
                        </View>
                        <View style={styles.trustTextCol}>
                            <Text style={styles.trustTitle}>Trust Anchor</Text>
                            <Text style={styles.trustDescription}>
                                Your daughter Spandana set up this helper.
                            </Text>
                        </View>
                        <View style={styles.trustRightIcon}>
                            <Ionicons name="people" size={28} color="#93c5fd" />
                        </View>
                    </TouchableOpacity>

                    {/* Quick Help Section */}
                    <View style={styles.quickHelpSection}>
                        <Text style={styles.sectionHeaderTitle}>Quick Help</Text>
                        <Text style={styles.sectionHeaderSub}>Tap to get support</Text>

                        <View style={styles.quickHelpGrid}>
                            {/* 1. Where am I? */}
                            <TouchableOpacity 
                                style={[styles.helpCard, styles.helpCardBlue]}
                                activeOpacity={0.8}
                                onPress={handleWhereAmI}
                            >
                                <View style={[styles.helpIconCircle, { backgroundColor: '#dbeafe' }]}>
                                    <Ionicons name="location" size={24} color="#2563eb" />
                                </View>
                                <Text style={styles.helpCardTitle}>Where am I?</Text>
                                <Text style={styles.helpCardSub}>Get your location</Text>
                            </TouchableOpacity>

                            {/* 2. What should I do? */}
                            <TouchableOpacity 
                                style={[styles.helpCard, styles.helpCardGreen]}
                                activeOpacity={0.8}
                                onPress={handleWhatShouldIDo}
                            >
                                <View style={[styles.helpIconCircle, { backgroundColor: '#dcfce7' }]}>
                                    <Ionicons name="checkbox-outline" size={24} color="#16a34a" />
                                </View>
                                <Text style={styles.helpCardTitle}>What should I do?</Text>
                                <Text style={styles.helpCardSub}>View next task</Text>
                            </TouchableOpacity>

                            {/* 3. Who is helping me? */}
                            <TouchableOpacity 
                                style={[styles.helpCard, styles.helpCardPurple]}
                                activeOpacity={0.8}
                                onPress={handleWhoIsHelpingMe}
                            >
                                <View style={[styles.helpIconCircle, { backgroundColor: '#f3e8ff' }]}>
                                    <Ionicons name="people" size={24} color="#9333ea" />
                                </View>
                                <Text style={styles.helpCardTitle}>Who is helping me?</Text>
                                <Text style={styles.helpCardSub}>Family & Caregivers</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Next Scheduled Medication Section */}
                    <View style={styles.nextMedSection}>
                        <View style={styles.medHeaderRow}>
                            <Text style={styles.sectionHeaderTitle}>Next Scheduled Medication</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Medication')}>
                                <Text style={styles.viewAllText}>View all</Text>
                            </TouchableOpacity>
                        </View>

                        {nextPendingMed ? (
                            <View style={styles.medCard}>
                                <View style={styles.medLeftInfo}>
                                    <View style={styles.medIconCircle}>
                                        <Ionicons name="bandage-outline" size={24} color="#2563eb" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.medNameText}>{nextMedTitle}</Text>
                                        <Text style={styles.medCategoryText}>{nextMedCategory}</Text>
                                        <View style={styles.medTimeRow}>
                                            <Ionicons name="time-outline" size={15} color="#64748b" />
                                            <Text style={styles.medTimeText}>{nextMedTime}</Text>
                                        </View>
                                        <Text style={styles.medInstructionText}>Take with warm water</Text>
                                    </View>
                                </View>
                                <TouchableOpacity 
                                    style={styles.markTakenBtn}
                                    activeOpacity={0.85}
                                    onPress={() => handleMarkNextMedTaken(nextPendingMed)}
                                >
                                    <Text style={styles.markTakenBtnText}>MARK AS TAKEN</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.medCard, { justifyContent: 'center', gap: 10, flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="checkmark-circle" size={28} color="#16a34a" />
                                <View>
                                    <Text style={[styles.medNameText, { color: '#15803d' }]}>All medications taken!</Text>
                                    <Text style={styles.medCategoryText}>Great job today 🎉</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Need Help Now? SOS Card */}
                    <TouchableOpacity 
                        style={styles.sosCard} 
                        activeOpacity={0.85}
                        onPress={handlePanic}
                    >
                        <View style={styles.sosBadge}>
                            <Text style={styles.sosBadgeText}>SOS</Text>
                        </View>
                        <View style={styles.sosTextCol}>
                            <Text style={styles.sosTitle}>Need help now?</Text>
                            <Text style={styles.sosSub}>Tap the SOS button for immediate assistance.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#f87171" />
                    </TouchableOpacity>

                </ScrollView>
            </View>

            {/* Voice Assistant / Memory Companion Modal */}
            <Modal visible={voiceModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.voiceCard}>
                        <View style={styles.voiceHeader}>
                            <Ionicons name="sparkles" size={28} color="#6366f1" />
                            <Text style={styles.voiceHeaderText}>Memory Companion</Text>
                        </View>

                        <Animated.View style={[styles.voiceIconRing, { transform: [{ scale: pulseAnim }] }]}>
                            <Ionicons name="volume-high" size={44} color="white" />
                        </Animated.View>

                        <Text style={styles.voiceMsg}>{voiceTitle}</Text>

                        {companionText ? (
                            <View style={styles.companionBox}>
                                <Text style={styles.companionText}>{companionText}</Text>
                            </View>
                        ) : null}

                        {activeReminder && (
                            <View style={styles.voiceBtnRow}>
                                <TouchableOpacity
                                    style={[styles.voiceBtn, styles.takenBtn]}
                                    onPress={() => handleVoiceConfirm(activeReminder.id, true)}
                                >
                                    <Ionicons name="checkmark-circle" size={22} color="white" />
                                    <Text style={styles.voiceBtnText}>TAKEN ✓</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.voiceBtn, styles.missedBtn]}
                                    onPress={() => handleVoiceConfirm(activeReminder.id, false)}
                                >
                                    <Ionicons name="close-circle" size={22} color="white" />
                                    <Text style={styles.voiceBtnText}>NOT TAKEN</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity style={styles.dismissBtn} onPress={closeVoiceModal}>
                            <Text style={styles.dismissText}>CLOSE HELPER</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    rootContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
        height: Platform.OS === 'web' ? '100vh' : '100%',
    },
    bodyLayout: {
        flex: 1,
        flexDirection: 'row',
        minHeight: 0,
        height: Platform.OS === 'web' ? 'calc(100vh - 70px)' : '100%',
        overflow: 'hidden'
    },
    mainCanvas: {
        flex: 1,
        minHeight: 0,
        backgroundColor: '#ffffff',
        ...(Platform.OS === 'web' ? { height: 'calc(100vh - 70px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {})
    },
    canvasContent: {
        padding: 24,
        paddingBottom: 100,
        maxWidth: 780,
        width: '100%',
        alignSelf: 'center',
    },
    greetingSection: {
        marginBottom: 20
    },
    greetingHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6
    },
    sunIcon: {
        fontSize: 26
    },
    greetingTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    smiley: {
        fontSize: 20
    },
    greetingSubtitle: {
        fontSize: 14,
        color: '#64748b'
    },
    trustAnchorCard: {
        backgroundColor: '#eff6ff',
        borderRadius: 18,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginBottom: 24,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1
    },
    trustHeartCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#1d4ed8',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    trustTextCol: {
        flex: 1
    },
    trustTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e3a8a',
        marginBottom: 2
    },
    trustDescription: {
        fontSize: 13,
        color: '#3b82f6',
        fontWeight: '500'
    },
    trustRightIcon: {
        marginLeft: 10
    },
    quickHelpSection: {
        marginBottom: 24
    },
    sectionHeaderTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2
    },
    sectionHeaderSub: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 14
    },
    quickHelpGrid: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between'
    },
    helpCard: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 12,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1
    },
    helpCardBlue: {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe'
    },
    helpCardGreen: {
        backgroundColor: '#f0fdf4',
        borderColor: '#dcfce7'
    },
    helpCardPurple: {
        backgroundColor: '#faf5ff',
        borderColor: '#f3e8ff'
    },
    helpIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    helpCardTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 4
    },
    helpCardSub: {
        fontSize: 11,
        color: '#64748b',
        textAlign: 'center'
    },
    nextMedSection: {
        marginBottom: 24
    },
    medHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    viewAllText: {
        fontSize: 13,
        color: '#2563eb',
        fontWeight: '600'
    },
    medCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2
    },
    medLeftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 14
    },
    medIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    medNameText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    medCategoryText: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 6
    },
    medTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2
    },
    medTimeText: {
        fontSize: 12,
        color: '#0f172a',
        fontWeight: '600'
    },
    medInstructionText: {
        fontSize: 11,
        color: '#64748b'
    },
    markTakenBtn: {
        backgroundColor: '#ea580c',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3
    },
    markTakenBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.3
    },
    sosCard: {
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fecaca',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1
    },
    sosBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        marginRight: 14
    },
    sosBadgeText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13
    },
    sosTextCol: {
        flex: 1
    },
    sosTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#991b1b'
    },
    sosSub: {
        fontSize: 12,
        color: '#dc2626'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    voiceCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    voiceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16
    },
    voiceHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e1b4b'
    },
    voiceIconRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    voiceMsg: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 10
    },
    companionBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 18,
        width: '100%'
    },
    companionText: {
        fontSize: 14,
        color: '#334155',
        lineHeight: 20,
        textAlign: 'center'
    },
    voiceBtnRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginBottom: 12
    },
    voiceBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6
    },
    takenBtn: {
        backgroundColor: '#16a34a'
    },
    missedBtn: {
        backgroundColor: '#dc2626'
    },
    voiceBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    dismissBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20
    },
    dismissText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 13
    }
});
