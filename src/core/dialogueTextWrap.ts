/** 언어별 단어 경계를 쓰고, 긴 단어만 글자 단위로 나눈다. 결합 문자·이모지는 분리하지 않는다. */
export function wrapDialogueText(text: string, width: number, measure: (text: string) => number, language: string): string[] {
  const words = new Intl.Segmenter(language, { granularity: "word" });
  const graphemes = new Intl.Segmenter(language, { granularity: "grapheme" });
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    const flush = () => { lines.push(line.trimEnd()); line = ""; };
    const tokens: string[] = [];
    for (const { segment } of words.segment(paragraph)) {
      // 닫는 문장부호는 앞말에, 여는 괄호는 뒷말에 붙여 줄머리·줄끝에 홀로 남기지 않는다.
      if (tokens.length && (/^[、。，．！？!?.,:;）)\]」』】]/u.test(segment) || /[（(\[「『【]$/u.test(tokens[tokens.length - 1]))) tokens[tokens.length - 1] += segment;
      else tokens.push(segment);
    }
    for (const segment of tokens) {
      if (!line && /^\s+$/u.test(segment)) continue;
      if (measure(line + segment) <= width) { line += segment; continue; }
      if (line) flush();
      const word = segment.trimStart();
      if (measure(word) <= width) { line = word; continue; }
      for (const { segment: character } of graphemes.segment(word)) {
        if (line && measure(line + character) > width) flush();
        line += character;
      }
    }
    flush();
  }
  return lines;
}
