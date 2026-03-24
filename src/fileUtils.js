import mammoth from 'mammoth';

const QUESTIONS = [
  "What do I want to achieve",
  "What will I let go of and what do I start doing more",
  "What could AI help me with",
  "Who should I talk to",
  "How do I know that my plan is working",
];

/**
 * Extract text from uploaded file (TXT, DOC, DOCX, PDF, PPTX)
 */
export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt')) {
    return await file.text();
  }

  if (name.endsWith('.doc') || name.endsWith('.docx')) {
    return await extractFromDocx(file);
  }

  if (name.endsWith('.pdf')) {
    return await extractFromPdf(file);
  }

  if (name.endsWith('.ppt') || name.endsWith('.pptx')) {
    return await extractFromPptx(file);
  }

  throw new Error(`Unsupported file format. Please upload a TXT, DOCX, PDF, or PPTX file.`);
}

async function extractFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push(text);
  }

  return pages.join('\n\n');
}

async function extractFromPptx(file) {
  const JSZip = (await import('jszip')).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideTexts = [];
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
    .sort();

  for (const slideName of slideFiles) {
    const xml = await zip.files[slideName].async('string');
    // Strip XML tags to get raw text
    const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) slideTexts.push(text);
  }

  return slideTexts.join('\n\n');
}

/**
 * Parse extracted text into 5 answer slots
 */
export function parseAnswers(text) {
  const answers = ['', '', '', '', ''];
  const lines = text.split('\n');
  let currentQ = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for numbered answers: "1.", "1)", "1:"
    const numMatch = trimmed.match(/^(\d)[.):\s]\s*(.*)/);
    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      if (idx >= 0 && idx < 5) {
        currentQ = idx;
        if (numMatch[2]) {
          answers[idx] = (answers[idx] ? answers[idx] + ' ' : '') + numMatch[2];
        }
        continue;
      }
    }

    // Check for question phrase matches
    let matched = false;
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i].toLowerCase();
      if (trimmed.toLowerCase().includes(q.slice(0, 25))) {
        currentQ = i;
        const afterColon = trimmed.split(':').slice(1).join(':').trim();
        if (afterColon) {
          answers[i] = (answers[i] ? answers[i] + ' ' : '') + afterColon;
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Append to current question
    if (currentQ >= 0) {
      answers[currentQ] = (answers[currentQ] ? answers[currentQ] + ' ' : '') + trimmed;
    }
  }

  return answers;
}
