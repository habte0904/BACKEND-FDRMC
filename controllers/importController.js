import Template from '../models/Template.js';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export const importWordTemplate = async (req, res) => {
    try {
        console.log('Import attempt - File:', req.file ? req.file.originalname : 'MISSING');
        console.log('Category/ModuleType:', req.body.category, req.body.moduleType);

        if (req.file) {
            console.log('File metadata:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                hasBuffer: !!req.file.buffer
            });
        }

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ message: 'No file uploaded or file buffer is empty' });
        }

        const { category, moduleType } = req.body;

        // Convert docx to HTML to preserve structural elements like tables and list items
        console.log('Extracting HTML with mammoth for structural analysis...');
        const { value: html } = await mammoth.convertToHtml({ buffer: req.file.buffer });

        // Modules/Sections/Fields hierarchy
        const modules = [];
        let currentModule = null;
        let currentSection = null;
        let currentField = null;

        const addModule = (title) => {
            currentModule = {
                moduleId: `mod_${uuidv4().substring(0, 8)}`,
                title: title || 'New Module',
                order: modules.length + 1,
                sections: []
            };
            modules.push(currentModule);
            currentSection = { sectionId: uuidv4(), title: 'General', fields: [] };
            currentModule.sections.push(currentSection);
            currentField = null;
        };

        // Split HTML into blocks (paragraphs, tables, headings)
        const blocks = html.split(/<(?=h[1-6]|p|table)/i);

        blocks.forEach((block) => {
            const raw = block.trim();
            if (!raw) return;

            // Normalize block to close its own tags for parsing
            const content = `<${raw}`.replace(/<<+/, '<');
            const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!textContent) return;

            // 1. Detect Modules/Chapters (H1, H2, or BOLD CAPITALS)
            const isHeading = content.match(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/i) ||
                (content.match(/<strong>(.*?)<\/strong>/i) && textContent.length < 100 && textContent === textContent.toUpperCase() && textContent.length > 3);

            if (isHeading) {
                addModule(textContent);
                return;
            }

            // 2. Detect Sections (H3, H4, or Ends with Colon/significant bold)
            const isSection = content.match(/<h[3-4][^>]*>(.*?)<\/h3|4]>/i) ||
                (textContent.length < 100 && textContent.endsWith(':') && !textContent.match(/^(q\d+|question)/i)) ||
                (content.match(/<strong>(.*?)<\/strong>/i) && textContent.length < 80 && textContent.match(/^(Section|Part|Chapter|Module|Block)\s+[A-Z0-9]/i));

            if (isSection && currentModule) {
                currentSection = {
                    sectionId: uuidv4(),
                    title: textContent.replace(/:$/, '').trim(),
                    fields: []
                };
                currentModule.sections.push(currentSection);
                currentField = null;
                return;
            }

            // 3. Detect Table (Matrix Question)
            if (content.match(/<table/i)) {
                // Extract rows and columns
                const rows = [];
                const trRegex = /<tr[^>]*>(.*?)<\/tr>/gi;
                let trMatch;

                while ((trMatch = trRegex.exec(content)) !== null) {
                    const rowHtml = trMatch[1];
                    const cells = [];
                    const tdRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gi;
                    let tdMatch;
                    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
                        cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
                    }
                    if (cells.length > 0) rows.push(cells);
                }

                if (rows.length > 1) {
                    const header = rows[0];
                    const dataRows = rows.slice(1);

                    if (!currentSection) addModule('Survey Section');

                    const matrixField = {
                        fieldId: uuidv4(),
                        questionCode: `qmtx_${uuidv4().substring(0, 4)}`,
                        label: (currentField && (currentField.type === 'note' || currentField.type === 'text')) ? currentField.label : 'Information Matrix',
                        type: 'matrix',
                        matrixConfig: {
                            columns: header.slice(1).map(c => ({ label: c, value: c })),
                            rows: dataRows.map(r => ({ label: r[0], value: r[0] })),
                            cellType: 'radio'
                        },
                        required: false,
                        options: [],
                        helpText: 'Select the most appropriate option for each row.',
                        permissions: { visibleToRoles: [], editableByRoles: [] }
                    };
                    currentSection.fields.push(matrixField);
                    currentField = matrixField;
                    return;
                }
            }

            // 4. Detect Question (q101 style, 1. style, or starting with "Question")
            const qRegex = /^\s*(q?\d+[a-z]?(?:\.\d+)*|Question\s*\d+|[A-Z]\d{1,3})[\.\s\t:]+(.*)/i;
            const questionMatch = textContent.match(qRegex) || (textContent.endsWith('?') && textContent.length < 200 ? [null, `q_${uuidv4().substring(0, 4)}`, textContent] : null);

            if (questionMatch) {
                const qCode = questionMatch[1].toLowerCase();
                const qLabel = questionMatch[2] ? questionMatch[2].trim() : textContent;

                if (!currentSection) addModule('Questionnaire');

                let autoFill = 'none';
                const lowerLabel = qLabel.toLowerCase();
                if (lowerLabel.includes('name') && (lowerLabel.includes('facilitator') || lowerLabel.includes('enumerator') || lowerLabel.includes('supervisor'))) {
                    autoFill = 'user_name';
                } else if (lowerLabel.includes('phone') && (lowerLabel.includes('facilitator') || lowerLabel.includes('enumerator'))) {
                    autoFill = 'user_phone';
                } else if (lowerLabel.match(/\bsub-?city\b/i)) {
                    autoFill = 'user_subcity';
                } else if (lowerLabel.match(/\bkebele\b/i)) {
                    autoFill = 'user_kebele';
                }

                currentField = {
                    fieldId: uuidv4(),
                    questionCode: qCode.includes('_') ? qCode : qCode.replace(/[^a-z0-9]/g, ''),
                    label: qLabel,
                    type: (qLabel.toLowerCase().includes('age') || qLabel.toLowerCase().includes('how many') || qLabel.toLowerCase().includes('number')) ? 'number' : 'text',
                    required: false,
                    options: [],
                    helpText: '',
                    systemAutoFill: autoFill,
                    permissions: { visibleToRoles: [], editableByRoles: [] }
                };
                currentSection.fields.push(currentField);

                // Detect embedded instructions (italicized in HTML)
                const instructionMatch = content.match(/<em[^>]*>(.*?)<\/em>|<i[^>]*>(.*?)<\/i>/i);
                if (instructionMatch) {
                    currentField.helpText = (instructionMatch[1] || instructionMatch[2]).replace(/<[^>]+>/g, '').trim();
                }
                return;
            }

            // 5. Detect Options (Bullets, checkboxes, or starting with 'o', '-', '*', or sequential a), 1) )
            const bulletRegex = /<li>|<\s*p[^>]*>\s*(?:[o○\u25CB\u25EF\u25E6\u2610\u2611\u2612\u25A1\u25A0\-*+]|\[\s*\]|\(\s*\)|[a-z0-9]{1,2}[\)\.])\s+/i;
            const isBullet = content.match(bulletRegex);
            if (isBullet && currentField) {
                const optText = textContent.replace(/^([o○\u25CB\u25EF\u25E6\u2610\u2611\u2612\u25A1\u25A0\-*+]|\[\s*\]|\(\s*\)|[a-z0-9]{1,2}[\)\.])\s+/, '').trim();
                if (optText) {
                    if (currentField.type === 'text' || currentField.type === 'note') {
                        currentField.type = 'radio';
                    }
                    currentField.options.push({ label: optText, value: String(currentField.options.length + 1) });
                    return;
                }
            }

            // 6. Greedy Text Catch-all
            if (currentField && textContent.length > 2) {
                const isInstruction = textContent.match(/^(Enumerator|Note|Instruction|Skip|If|Read|Please|Select|Only|Note:)/i) || content.match(/<em|<i/i);
                const isConditional = textContent.match(/^(If|Skip|When|Go to)/i);

                if (isInstruction) {
                    currentField.helpText = currentField.helpText ? `${currentField.helpText}\n${textContent}` : textContent;
                    if (isConditional) {
                        currentField.conditionalLogic = {
                            ...currentField.conditionalLogic,
                            statement: (currentField.conditionalLogic?.statement || '') + ' ' + textContent
                        };
                    }
                } else if (!textContent.match(qRegex) && textContent.length < 400) {
                    // If it's not a question and not a bullet, decide if it's continuation or a new note
                    if (textContent.length < 150 && (currentField.type === 'text' || currentField.type === 'note')) {
                        currentField.label += ' ' + textContent;
                    } else if (currentSection) {
                        currentField = {
                            fieldId: uuidv4(),
                            questionCode: `note_${uuidv4().substring(0, 4)}`,
                            label: textContent,
                            type: 'note',
                            required: false,
                            options: [],
                            helpText: '',
                            permissions: { visibleToRoles: [], editableByRoles: [] }
                        };
                        currentSection.fields.push(currentField);
                    }
                }
            } else if (currentSection && textContent.length > 5 && !textContent.match(qRegex)) {
                let autoFill = 'none';
                const lowerText = textContent.toLowerCase();
                if (lowerText.match(/\bsub-?city\b/i)) autoFill = 'user_subcity';
                else if (lowerText.match(/\bkebele\b/i)) autoFill = 'user_kebele';
                else if (lowerText.includes('name') && lowerText.includes('phone')) autoFill = 'user_name'; // Mixed or ambiguous

                currentField = {
                    fieldId: uuidv4(),
                    questionCode: `info_${uuidv4().substring(0, 4)}`,
                    label: textContent,
                    type: 'note',
                    required: false,
                    options: [],
                    helpText: '',
                    systemAutoFill: autoFill,
                    permissions: { visibleToRoles: [], editableByRoles: [] }
                };
                currentSection.fields.push(currentField);
            }
        });

        console.log('Parsing complete. Modules found:', modules.length);

        res.json({
            name: req.file.originalname.replace('.docx', ''),
            category: category || 'Household',
            moduleType: moduleType || 'HHQ',
            modules
        });

    } catch (error) {
        console.error('Import error:', error);
        fs.appendFileSync('import_errors.log', `${new Date().toISOString()} - ${error.message}\n${error.stack}\n`);
        res.status(500).json({
            message: 'Error parsing Word document',
            details: error.message
        });
    }
};
