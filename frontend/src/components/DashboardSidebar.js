import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardSidebar({
    items = [],
    activeKey = '',
    onSelect,
    activeColor = '#2563eb', // Blue for patient & doctor, green for caregiver
    activeBg = '#eff6ff'
}) {
    return (
        <View style={styles.sidebarContainer}>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sidebarScroll}
            >
                {items.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                        <TouchableOpacity
                            key={item.key}
                            style={[
                                styles.navItem,
                                isActive && [styles.activeNavItem, { backgroundColor: activeBg }]
                            ]}
                            activeOpacity={0.7}
                            onPress={() => onSelect(item.key)}
                        >
                            <View style={styles.iconAndLabel}>
                                <Ionicons
                                    name={isActive ? (item.activeIcon || item.icon) : item.icon}
                                    size={20}
                                    color={isActive ? activeColor : '#64748b'}
                                />
                                <Text
                                    style={[
                                        styles.navLabel,
                                        isActive && [styles.activeNavLabel, { color: activeColor }]
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </View>

                            {item.badge ? (
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>{item.badge}</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebarContainer: {
        width: 175,
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 18,
        paddingHorizontal: 12
    },
    sidebarScroll: {
        gap: 6
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 2
    },
    activeNavItem: {
        shadowColor: 'rgba(0,0,0,0.03)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 1
    },
    iconAndLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    navLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#475569'
    },
    activeNavLabel: {
        fontWeight: 'bold'
    },
    badgeContainer: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold'
    }
});
