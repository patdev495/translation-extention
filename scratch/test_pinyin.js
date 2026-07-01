import { pinyin } from 'pinyin-pro';
console.log('default:', pinyin('Hello, 我喜欢学习汉语！'));
console.log('consecutive:', pinyin('Hello, 我喜欢学习汉语！', { nonZh: 'consecutive' }));
