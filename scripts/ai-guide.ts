// Generates docs/AI_GUIDE.md (rules + catalog) for AI agents working with layout JSON.
// Usage: npm run ai-guide
import { writeFileSync } from 'node:fs'
import { catalogText, DESIGN_TIPS, RULES } from '../src/ai/prompt'
import { TEMPLATES } from '../src/model/templates'

const example = TEMPLATES[0].layout()
const md = `# おへやこねこね AIエージェント向けガイド

このファイルは \`npm run ai-guide\` で自動生成しています。レイアウトJSONを作るときのルールと、使えるアイテムの一覧です。
JSONはアプリの「JSON」ダイアログに貼り付けるか、ファイルとしてドラッグ＆ドロップすると読み込めます。
検証で問題があれば、\`items[2].params.width\` のように場所を指してエラーが表示されます。

${RULES}

${DESIGN_TIPS}

## 使えるアイテム（カタログ）
${catalogText()}
## 例（6畳 1K）
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`
`
writeFileSync(new URL('../docs/AI_GUIDE.md', import.meta.url), md)
console.log('wrote docs/AI_GUIDE.md')
