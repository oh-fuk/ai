#!/usr/bin/env node
// Simple smoke test for grammar UI wrapping rule
// Rule: if original sentence length > 20 characters OR word count > 6, it should be wrapped (moved to next line)

function needsWrap(orig) {
    if (!orig) return false;
    const charCount = orig.length;
    const wordCount = orig.trim() ? orig.trim().split(/\s+/).length : 0;
    return charCount > 20 || wordCount > 6;
}

const tests = [
    { input: 'This is fine.', expect: false, note: 'short sentence' },
    { input: 'a b c d e f', expect: false, note: 'exactly 6 short words -> no wrap' },
    { input: 'One two three four five six seven', expect: true, note: '7 words -> wrap' },
    { input: 'aaaaaaaaaaaaaaaaaaaa', expect: false, note: '20 chars exactly -> no wrap' },
    { input: 'aaaaaaaaaaaaaaaaaaaaa', expect: true, note: '21 chars -> wrap' },
    { input: '', expect: false, note: 'empty string' },
    // Additional cases: punctuation and multi-line inputs
    { input: 'Wow!', expect: false, note: 'short exclamation' },
    { input: 'Short, crisp sentence.', expect: true, note: 'short with punctuation exceeding 20 chars -> wrap' },
    { input: 'This is a long sentence,\nthat spans multiple lines and should be wrapped', expect: true, note: 'multi-line long -> wrap' },
    { input: 'Line one\nLine two', expect: false, note: 'two short lines total words <=6 -> no wrap' },
    { input: 'Hello, world! This test has punctuation and more words to push it', expect: true, note: 'punctuation and >6 words -> wrap' },
];

let failed = 0;
console.log('Grammar UI wrapping smoke test (rule: >20 chars OR >6 words => wrap)');
tests.forEach((t, i) => {
    const got = needsWrap(t.input);
    const pass = got === t.expect;
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'} [${i + 1}] ${t.note} | input='${t.input}' | expected=${t.expect} got=${got}`);
});

if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
} else {
    console.log('\nAll tests passed');
    process.exit(0);
}
