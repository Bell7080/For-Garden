/**
 * 공백이 없는 언어(일본어·중국어·태국어)의 줄바꿈.
 *
 * Phaser의 기본 줄바꿈은 **공백에서만** 끊는다. 일본어 대사는 공백이 없으니 한 줄로 이어져 판
 * 오른쪽 밖으로 나가 잘렸다. 그래서 글자 사이에서도 끊되, 줄 머리에 오면 안 되는 닫는 문장부호와
 * 줄 끝에 오면 안 되는 여는 부호는 금칙으로 지킨다. 재는 일은 호출하는 쪽이 넘기므로 Phaser가 없다.
 */

/** 줄 머리에 오면 안 되는 글자(닫는 부호·장음·작은 가나·반복 부호). */
const NO_LINE_START = /^[、。，．,.!?！？：；:;」』）】〉》］｝)\]}〕”’・ー〜～…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々ゝゞヽヾ]$/u;
/** 줄 끝에 오면 안 되는 글자(여는 부호). */
const NO_LINE_END = /^[「『（【〈《［｛(\[{〔“‘]$/u;
/** 글자 사이에서 끊어도 되는 문자(가나·한자·태국 문자·전각; 한글은 공백으로 끊는다). */
const BREAKABLE = /^[ก-ะเ-ๆ぀-ヿ㐀-鿿豈-﫿＀-￯　-〿]$/u;
/** 태국어에서 앞 글자에 붙는 결합 모음·성조(줄 머리에 올 수 없다). */
const THAI_COMBINING = /^[ัิ-ฺ็-๎]$/u;
/** 태국어 선행 모음(뒤 글자와 떨어져 줄 끝에 올 수 없다). */
const THAI_LEADING = /^[เ-ไ]$/u;

/** 한 줄의 폭을 재는 함수. */
export type MeasureWidth = (text: string) => number;

/** 글자 사이 줄바꿈이 필요한 문자가 하나라도 있는가. */
export function needsCharWrap(text: string): boolean {
  for (const ch of text) if (BREAKABLE.test(ch)) return true;
  return false;
}

/** 줄 나눔의 최소 단위: 낱글자(끊을 수 있는 문자) 또는 공백으로 끝나는 낱말. */
function splitUnits(paragraph: string): string[] {
  const units: string[] = [];
  let word = "";
  const flush = (): void => {
    if (word) units.push(word);
    word = "";
  };
  for (const ch of Array.from(paragraph)) {
    if (ch === " ") {
      word += ch;
      flush();
    } else if (BREAKABLE.test(ch)) {
      // 결합 부호·금칙 문자는 앞 단위에 붙여 줄 머리에 서지 않게 한다.
      if (THAI_COMBINING.test(ch) || NO_LINE_START.test(ch)) {
        if (word) word += ch;
        else if (units.length) units[units.length - 1] += ch;
        else units.push(ch);
        continue;
      }
      // 앞 단위가 여는 부호·태국 선행 모음이면 이 글자에 붙인다.
      const prev = word || "";
      if (!prev && units.length) {
        const last = units[units.length - 1];
        const lastChar = Array.from(last).pop() ?? "";
        if (NO_LINE_END.test(lastChar) || THAI_LEADING.test(lastChar)) {
          units[units.length - 1] = last + ch;
          continue;
        }
      }
      flush();
      units.push(ch);
    } else {
      word += ch;
    }
  }
  flush();
  return units;
}

/** 폭 안에 들도록 줄바꿈한 문자열. 문단(`\n`)은 그대로 둔다. */
export function wrapByCharacter(text: string, width: number, measure: MeasureWidth): string {
  return text
    .split(/\r\n|\r|\n/)
    .map((paragraph) => {
      const lines: string[] = [];
      let line = "";
      for (const unit of splitUnits(paragraph)) {
        const candidate = line + unit;
        if (line && measure(candidate.trimEnd()) > width) {
          lines.push(line.trimEnd());
          line = unit.trimStart();
        } else {
          line = candidate;
        }
      }
      lines.push(line.trimEnd());
      return lines.join("\n");
    })
    .join("\n");
}
