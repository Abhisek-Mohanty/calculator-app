/**
 * Premium Calculator - React Native
 * With Dark / Light Mode + Local MP3 Click Sound
 *
 * Setup:
 * 1. npx create-expo-app CalculatorApp
 * 2. cd CalculatorApp
 * 3. Paste this file as App.js
 * 4. Place your MP3 at:  assets/audio/click.mp3
 * 5. npx expo install expo-av
 * 6. npx expo start
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

// ─── Sound Hook ───────────────────────────────────────────────────────────────
// Loads the MP3 once on mount, exposes a play() function.
// ⚠️  Audio.Sound.createAsync must be called INSIDE useEffect — never at
//     the top level of a module (no top-level await in React Native).
function useClickSound() {
  const soundRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        // Allow sound to play even when the phone is on silent (iOS)
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

        const { sound } = await Audio.Sound.createAsync(
          require('../assets/audio/denielcz-immersivecontrol-button-click-sound-463065.mp3'),
          { shouldPlay: false, volume: 1.0 }
        );
        if (mounted) soundRef.current = sound;
      } catch (e:any) {
        // File missing or simulator — silently ignore, app still works
        console.warn('Sound load failed:', e.message);
      }
    };

    load();

    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  const play = useCallback(async () => {
    try {
      if (!soundRef.current) return;
      // Rewind to start so rapid taps don't wait for previous play to end
      await soundRef.current.setPositionAsync(0);
      await soundRef.current.playAsync();
    } catch (_) {}
  }, []);

  return play;
}

// ─── Theme Palettes ────────────────────────────────────────────────────────────
const lightColors = {
  primary: '#005ab4',
  primaryContainer: '#0a73e0',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#fefcff',
  secondaryContainer: '#b6d0ff',
  onSecondaryContainer: '#3f5881',
  surface: '#f9f9ff',
  surfaceContainerLow: '#f1f3fc',
  surfaceContainerHigh: '#e6e8f1',
  surfaceContainer: '#ebedf7',
  onSurface: '#181c22',
  onSurfaceVariant: '#414753',
  outlineVariant: '#c1c6d5',
  error: '#ba1a1a',
  background: '#f9f9ff',
  toggleBg: '#e6e8f1',
  toggleKnob: '#005ab4',
};

const darkColors = {
  primary: '#aac7ff',
  primaryContainer: '#1a4880',
  onPrimary: '#002f6d',
  onPrimaryContainer: '#d6e3ff',
  secondaryContainer: '#2d476f',
  onSecondaryContainer: '#aec7f7',
  surface: '#111318',
  surfaceContainerLow: '#1d2025',
  surfaceContainerHigh: '#272b31',
  surfaceContainer: '#1d2025',
  onSurface: '#e2e2e9',
  onSurfaceVariant: '#c3c6d3',
  outlineVariant: '#43474e',
  error: '#ffb4ab',
  background: '#111318',
  toggleBg: '#2d476f',
  toggleKnob: '#aac7ff',
};

// ─── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle, C }) {
  const anim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  const handleToggle = () => {
    Animated.spring(anim, {
      toValue: isDark ? 0 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
    onToggle();
  };

  const knobTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 26],
  });

  return (
    <TouchableOpacity
      onPress={handleToggle}
      activeOpacity={0.85}
      style={[styles.toggleTrack, { backgroundColor: C.toggleBg }]}
    >
      <Animated.View
        style={[
          styles.toggleKnob,
          { backgroundColor: C.toggleKnob, transform: [{ translateX: knobTranslate }] },
        ]}
      >
        <Text style={styles.toggleIcon}>{isDark ? '🌙' : '☀️'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Calc Button ───────────────────────────────────────────────────────────────
function CalcButton({ label, onPress, style, labelStyle, wide, playSound }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    // Play sound the instant the finger touches
    playSound?.();
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start();
    onPress?.();
  };

  return (
    <Animated.View style={[wide ? styles.wideCell : styles.cell, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.btnBase, style]}
      >
        <Text style={[styles.labelBase, labelStyle]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── History Item ──────────────────────────────────────────────────────────────
function HistoryItem({ entry, C }) {
  return (
    <View style={[styles.historyItem, { backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant }]}>
      <Text style={[styles.historyExpression, { color: C.onSurfaceVariant }]}>{entry.expression}</Text>
      <Text style={[styles.historyResult, { color: C.primary }]}>= {entry.result}</Text>
    </View>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark]         = useState(false);
  const [currentInput, setCurrentInput] = useState('0');
  const [previousInput, setPreviousInput] = useState('');
  const [operator, setOperator]     = useState(null);
  const [shouldReset, setShouldReset] = useState(false);
  const [historyLabel, setHistoryLabel] = useState('');
  const [activeTab, setActiveTab]   = useState('basic');
  const [history, setHistory]       = useState([]);

  const C = isDark ? darkColors : lightColors;
  const displayScale = useRef(new Animated.Value(1)).current;

  // ── Sound ──
  const playSound = useClickSound();

  const toggleTheme = () => setIsDark((d) => !d);

  const flashDisplay = () => {
    Animated.sequence([
      Animated.timing(displayScale, { toValue: 1.05, duration: 80, useNativeDriver: true }),
      Animated.timing(displayScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleInput = (val) => {
    if (!isNaN(val) || val === '.') {
      if (val === '.' && currentInput.includes('.')) return;
      if (currentInput === '0' || shouldReset) {
        setCurrentInput(val === '.' ? '0.' : val);
        setShouldReset(false);
      } else {
        setCurrentInput((prev) => prev + val);
      }
    } else if (val === '+/-') {
      setCurrentInput((prev) => (parseFloat(prev) * -1).toString());
    } else if (val === '%') {
      setCurrentInput((prev) => (parseFloat(prev) / 100).toString());
    } else {
      if (operator) {
        performCalculate(val);
      } else {
        setPreviousInput(currentInput);
        setOperator(val);
        setShouldReset(true);
        setHistoryLabel(`${currentInput} ${val}`);
      }
    }
  };

  const performCalculate = (nextOperator = null) => {
    if (!operator) return;
    const prev = parseFloat(previousInput);
    const curr = parseFloat(currentInput);
    let result = 0;
    switch (operator) {
      case '+': result = prev + curr; break;
      case '-': result = prev - curr; break;
      case '×': result = prev * curr; break;
      case '÷': result = curr !== 0 ? prev / curr : 0; break;
    }
    const expression = `${previousInput} ${operator} ${currentInput}`;
    const resultStr  = parseFloat(result.toFixed(10)).toString();
    setHistory((h) => [{ expression, result: resultStr }, ...h].slice(0, 30));
    flashDisplay();

    if (nextOperator) {
      setPreviousInput(resultStr);
      setOperator(nextOperator);
      setShouldReset(true);
      setHistoryLabel(`${resultStr} ${nextOperator}`);
      setCurrentInput(resultStr);
    } else {
      setCurrentInput(resultStr);
      setOperator(null);
      setShouldReset(true);
      setHistoryLabel('');
    }
  };

  const clearDisplay = () => {
    setCurrentInput('0');
    setPreviousInput('');
    setOperator(null);
    setShouldReset(false);
    setHistoryLabel('');
  };

  const displayFontSize = currentInput.length > 12 ? 32 : currentInput.length > 8 ? 44 : 60;

  // Shared button props shorthand
  const numBtn  = (n) => ({
    style:      [styles.btnBase, { backgroundColor: C.surfaceContainerLow }],
    labelStyle: [styles.labelBase, { color: C.onSurface, fontSize: 24 }],
    playSound,
    onPress: () => handleInput(n),
  });
  const opBtn = (sym) => ({
    style:      [styles.btnBase, { backgroundColor: operator === sym ? C.primary : C.primaryContainer }],
    labelStyle: [styles.labelBase, { color: C.onPrimaryContainer, fontSize: 26 }],
    playSound,
    onPress: () => handleInput(sym),
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.surface} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.surface }]}>
        <Text style={[styles.headerTitle, { color: C.primary }]}>Calculator</Text>
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} C={C} />
      </View>

      {/* Content */}
      <View style={[styles.content, { backgroundColor: C.background }]}>
        {activeTab === 'basic' ? (
          <>
            {/* Display */}
            <View style={styles.displayArea}>
              <Text style={[styles.historyDisplayText, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                {historyLabel}
              </Text>
              <Animated.Text
                style={[styles.mainDisplayText, { fontSize: displayFontSize, color: C.onSurface, transform: [{ scale: displayScale }] }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {currentInput}
              </Animated.Text>
            </View>

            {/* Keypad */}
            <View style={styles.keypad}>
              {/* Row 1 */}
              <View style={styles.row}>
                <CalcButton label="C"   playSound={playSound} onPress={clearDisplay}
                  style={[styles.btnBase, { backgroundColor: C.surfaceContainerHigh }]}
                  labelStyle={[styles.labelBase, { color: C.error, fontSize: 20, fontWeight: '600' }]} />
                <CalcButton label="+/-" playSound={playSound} onPress={() => handleInput('+/-')}
                  style={[styles.btnBase, { backgroundColor: C.surfaceContainerHigh }]}
                  labelStyle={[styles.labelBase, { color: C.primary, fontSize: 20, fontWeight: '600' }]} />
                <CalcButton label="%" playSound={playSound} onPress={() => handleInput('%')}
                  style={[styles.btnBase, { backgroundColor: C.surfaceContainerHigh }]}
                  labelStyle={[styles.labelBase, { color: C.primary, fontSize: 20, fontWeight: '600' }]} />
                <CalcButton label="÷" {...opBtn('÷')} />
              </View>

              {/* Row 2 */}
              <View style={styles.row}>
                {['7','8','9'].map((n) => <CalcButton key={n} label={n} {...numBtn(n)} />)}
                <CalcButton label="×" {...opBtn('×')} />
              </View>

              {/* Row 3 */}
              <View style={styles.row}>
                {['4','5','6'].map((n) => <CalcButton key={n} label={n} {...numBtn(n)} />)}
                <CalcButton label="−" {...opBtn('-')} />
              </View>

              {/* Row 4 */}
              <View style={styles.row}>
                {['1','2','3'].map((n) => <CalcButton key={n} label={n} {...numBtn(n)} />)}
                <CalcButton label="+" {...opBtn('+')} />
              </View>

              {/* Row 5 */}
              <View style={styles.row}>
                <CalcButton label="0" wide playSound={playSound} onPress={() => handleInput('0')}
                  style={[styles.btnBase, styles.btnWide, { backgroundColor: C.surfaceContainerLow }]}
                  labelStyle={[styles.labelBase, { color: C.onSurface, fontSize: 24, marginLeft: 20 }]} />
                <CalcButton label="." playSound={playSound} onPress={() => handleInput('.')}
                  style={[styles.btnBase, { backgroundColor: C.surfaceContainerLow }]}
                  labelStyle={[styles.labelBase, { color: C.onSurface, fontSize: 24 }]} />
                <CalcButton label="=" playSound={playSound} onPress={() => performCalculate()}
                  style={[styles.btnBase, { backgroundColor: C.primary, shadowColor: C.primary,
                    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }]}
                  labelStyle={[styles.labelBase, { color: C.onPrimary, fontSize: 28, fontWeight: '600' }]} />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.historyContainer}>
            <Text style={[styles.historyTitle, { color: C.onSurface }]}>Calculation History</Text>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={[styles.emptyHistoryIcon, { color: C.outlineVariant }]}>◷</Text>
                <Text style={[styles.emptyHistoryText, { color: C.onSurfaceVariant }]}>No calculations yet</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {history.map((entry, i) => <HistoryItem key={i} entry={entry} C={C} />)}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: C.surfaceContainer, shadowOpacity: isDark ? 0.3 : 0.06 }]}>
        {[
          { id: 'basic',   icon: '⊞', label: 'Basic'   },
          { id: 'history', icon: '◷', label: 'History' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.navItem, isActive && { backgroundColor: C.secondaryContainer }]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.navIcon, { color: isActive ? C.onSecondaryContainer : C.onSurfaceVariant }]}>
                {tab.icon}
              </Text>
              <Text style={[styles.navLabel, { color: isActive ? C.onSecondaryContainer : C.onSurfaceVariant,
                fontWeight: isActive ? '700' : '500' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const BTN_GAP  = 12;
const SIDE_PAD = 20;
const BTN_SIZE = (width - SIDE_PAD * 2 - BTN_GAP * 3) / 4;

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },

  content: { flex: 1, paddingHorizontal: SIDE_PAD },

  displayArea: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', paddingVertical: 20 },
  historyDisplayText: { fontSize: 16, fontWeight: '500', opacity: 0.65, marginBottom: 6 },
  mainDisplayText:    { fontWeight: '700', letterSpacing: -1, textAlign: 'right' },

  keypad: { paddingBottom: 16, gap: BTN_GAP },
  row:    { flexDirection: 'row', gap: BTN_GAP },
  cell:   { width: BTN_SIZE, height: BTN_SIZE },
  wideCell: { width: BTN_SIZE * 2 + BTN_GAP, height: BTN_SIZE },

  btnBase:  { flex: 1, borderRadius: BTN_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  btnWide:  { alignItems: 'flex-start', paddingLeft: 28 },
  labelBase: { fontWeight: '500' },

  historyContainer: { flex: 1, paddingTop: 16 },
  historyTitle:     { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  historyItem:      { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  historyExpression:{ fontSize: 14, marginBottom: 4 },
  historyResult:    { fontSize: 22, fontWeight: '700' },
  emptyHistory:     { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyHistoryIcon: { fontSize: 48, marginBottom: 12 },
  emptyHistoryText: { fontSize: 16, opacity: 0.6 },

  bottomNav: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },
  navItem:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 16, gap: 2, marginBottom: 22 },
  navIcon:  { fontSize: 22 },
  navLabel: { fontSize: 11 },

  toggleTrack: { width: 54, height: 30, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 2 },
  toggleKnob:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toggleIcon:  { fontSize: 14 },
});