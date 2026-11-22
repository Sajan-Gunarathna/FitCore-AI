import React from 'react';
import { StyleSheet, Text, View, StatusBar, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      <View style={styles.card}>
        <Text style={styles.badge}>Commercial SaaS</Text>
        <Text style={styles.title}>FitCore AI</Text>
        <Text style={styles.subtitle}>
          Multi-tenant Gym Management & AI-Powered Fitness Platform
        </Text>
        
        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>FastAPI</Text>
            <Text style={styles.metricLabel}>Backend</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>Supabase</Text>
            <Text style={styles.metricLabel}>Auth & DB</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>Phase 0</Text>
            <Text style={styles.metricLabel}>Foundation</Text>
          </View>
        </View>

        <Text style={styles.statusText}>
          ● Mobile client structure initialized & ready
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    color: '#f4f4f5',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    color: '#f4f4f5',
    fontWeight: '700',
    fontSize: 14,
  },
  metricLabel: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#27272a',
  },
  statusText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
