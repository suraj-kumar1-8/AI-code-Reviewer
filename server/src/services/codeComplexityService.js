/**
 * Code Complexity Service
 * 
 * Performs deterministic static analysis of source files:
 * - Function length and parameter lists
 * - Cyclomatic complexity (branches: if, while, for, catch, case, ternaries, boolean logic)
 * - Maximum nesting depth
 * - File-level complexity metrics
 * 
 * Never relies on hallucinated numbers from LLMs for measurable metrics.
 */

export class CodeComplexityService {
  /**
   * Analyzes an array of file objects: [{ path, content, language }]
   */
  analyzeRepositoryFiles(files = []) {
    const fileReports = [];
    const allFunctions = [];

    for (const file of files) {
      if (!file || !file.content || typeof file.content !== 'string') continue;

      const fileReport = this.analyzeFile(file.path, file.content, file.language);
      fileReports.push(fileReport);

      if (fileReport.functions && fileReport.functions.length > 0) {
        allFunctions.push(...fileReport.functions.map(fn => ({ ...fn, file: file.path })));
      }
    }

    // Sort files by complexity descending
    fileReports.sort((a, b) => b.complexityScore - a.complexityScore);

    // Sort functions by cyclomatic complexity descending
    allFunctions.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);

    // Overall repository complexity score (0-100, where 100 is cleanest/least complex)
    const avgFileComplexity = fileReports.length > 0
      ? fileReports.reduce((sum, f) => sum + f.complexityScore, 0) / fileReports.length
      : 10;

    // Normalization: an average complexity score of 10 gives ~95 health, 50 gives ~50 health
    const normalizedScore = Math.max(10, Math.min(100, Math.round(100 - (avgFileComplexity * 1.2))));

    return {
      complexityScore: normalizedScore,
      rawAverageComplexity: Math.round(avgFileComplexity * 10) / 10,
      totalFilesAnalyzed: fileReports.length,
      totalFunctionsAnalyzed: allFunctions.length,
      mostComplexFiles: fileReports.slice(0, 10).map(f => ({
        path: f.path,
        complexityScore: f.complexityScore,
        lines: f.totalLines,
        functionsCount: f.functions.length,
        maxNestingDepth: f.maxNestingDepth,
        highestFunctionComplexity: f.highestFunctionComplexity,
      })),
      mostComplexFunctions: allFunctions.slice(0, 15).map(fn => ({
        name: fn.name,
        file: fn.file,
        line: fn.startLine,
        cyclomaticComplexity: fn.cyclomaticComplexity,
        linesCount: fn.linesCount,
        parameterCount: fn.parameterCount,
        nestingDepth: fn.nestingDepth,
      })),
      fileReports,
    };
  }

  /**
   * Analyzes a single file
   */
  analyzeFile(filePath, content, language = '') {
    const lines = content.split('\n');
    const totalLines = lines.length;
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    let currentNesting = 0;
    let maxNestingDepth = 0;

    let inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        blankLines++;
        continue;
      }

      if (inBlockComment) {
        commentLines++;
        if (line.includes('*/')) inBlockComment = false;
        continue;
      }

      if (line.startsWith('/*')) {
        commentLines++;
        if (!line.includes('*/')) inBlockComment = true;
        continue;
      }

      if (line.startsWith('//') || line.startsWith('#')) {
        commentLines++;
        continue;
      }

      codeLines++;

      // Track nesting depth using braces and indentation
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      currentNesting = Math.max(0, currentNesting + openBraces - closeBraces);
      if (currentNesting > maxNestingDepth) {
        maxNestingDepth = currentNesting;
      }
    }

    // Extract functions and compute complexity
    const functions = this.extractFunctions(filePath, lines);

    let highestFunctionComplexity = 1;
    let sumComplexity = 0;

    for (const fn of functions) {
      if (fn.cyclomaticComplexity > highestFunctionComplexity) {
        highestFunctionComplexity = fn.cyclomaticComplexity;
      }
      sumComplexity += fn.cyclomaticComplexity;
    }

    // File complexity calculation combines lines, max nesting, and function complexities
    const linePenalty = Math.floor(totalLines / 60);
    const nestingPenalty = maxNestingDepth * 3;
    const avgFnComplexity = functions.length > 0 ? (sumComplexity / functions.length) * 2 : 0;
    const fileComplexityScore = Math.min(100, Math.round(linePenalty + nestingPenalty + avgFnComplexity + (highestFunctionComplexity * 1.5)));

    return {
      path: filePath,
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      maxNestingDepth,
      functions,
      highestFunctionComplexity,
      complexityScore: fileComplexityScore,
    };
  }

  /**
   * Extracts function declarations and calculates cyclomatic complexity per function
   */
  extractFunctions(filePath, lines) {
    const functions = [];
    const functionRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?function\s*\(([^)]*)\)|(?:async\s+)?([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{|def\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\):/g;

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      let match;

      while ((match = functionRegex.exec(lineText)) !== null) {
        const name = match[1] || match[3] || match[5] || match[7] || match[9];
        const params = match[2] || match[4] || match[6] || match[8] || match[10] || '';

        // Filter out control flow matches that look like functions (if, while, catch, for, switch)
        if (!name || ['if', 'while', 'for', 'switch', 'catch', 'constructor'].includes(name.trim())) {
          continue;
        }

        const paramList = params.split(',').map(p => p.trim()).filter(Boolean);
        const startLine = i + 1;

        // Trace function body lines by bracket matching
        let braceBalance = 0;
        let started = false;
        let endLine = startLine;
        let functionNesting = 0;
        let maxFnNesting = 0;
        let cyclomaticComplexity = 1; // Base complexity

        for (let j = i; j < Math.min(lines.length, i + 300); j++) {
          const bodyLine = lines[j];

          // Count branches
          if (/\b(if|else if|while|for|catch|case)\b/.test(bodyLine)) {
            cyclomaticComplexity++;
          }
          if (/&&|\|\||\?\?/.test(bodyLine)) {
            cyclomaticComplexity++;
          }
          if (/\?[^:?]+:/.test(bodyLine)) {
            cyclomaticComplexity++; // Ternary
          }

          // Count braces
          const opens = (bodyLine.match(/{/g) || []).length;
          const closes = (bodyLine.match(/}/g) || []).length;
          if (opens > 0) started = true;

          braceBalance += opens - closes;
          functionNesting = Math.max(0, functionNesting + opens - closes);
          if (functionNesting > maxFnNesting) {
            maxFnNesting = functionNesting;
          }

          if (started && braceBalance <= 0) {
            endLine = j + 1;
            break;
          }
          endLine = j + 1;
        }

        functions.push({
          name: name.trim(),
          startLine,
          endLine,
          linesCount: endLine - startLine + 1,
          parameterCount: paramList.length,
          parameters: paramList,
          cyclomaticComplexity,
          nestingDepth: maxFnNesting,
        });
      }
    }

    return functions;
  }
}

export const codeComplexityService = new CodeComplexityService();
export default codeComplexityService;
