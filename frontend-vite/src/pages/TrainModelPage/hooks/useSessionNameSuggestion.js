// frontend-vite/src/pages/TrainModelPage/hooks/useSessionNameSuggestion.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTrainingHistory } from '../../../api';

function normalizeName(name = '') {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

const TASK_SUFFIX = {
  classification: '_cls',
  detection: '_det',
};

function stripTaskSuffix(name = '') {
  return name.replace(/_(cls|det)$/i, '');
}

function ensureTaskSuffix(name = '', taskType = 'classification') {
  const base = stripTaskSuffix(name.trim());
  const suffix = TASK_SUFFIX[taskType] || '';
  return base ? base + suffix : '';
}

function prefixSimilarity(a, b) {
  const na = normalizeName(stripTaskSuffix(a));
  const nb = normalizeName(stripTaskSuffix(b));
  if (!na || !nb) return 0;
  const minLen = Math.min(na.length, nb.length);
  let same = 0;
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) same++;
    else break;
  }
  return same / Math.max(na.length, nb.length);
}

function parseVersionInfo(name) {
  const cleaned = stripTaskSuffix(name);

  const m1 = cleaned.match(/^(.*?)[-_ ]?v(\d+)\s*$/i);
  if (m1) {
    return {
      base: m1[1].trim().replace(/[-_]+$/, ''),
      version: parseInt(m1[2], 10),
      style: 'v',
    };
  }

  const m2 = cleaned.match(/^(.*?)[-_ ]?version[-_ ]?(\d+)\s*$/i);
  if (m2) {
    return {
      base: m2[1].trim().replace(/[-_]+$/, ''),
      version: parseInt(m2[2], 10),
      style: 'version',
    };
  }

  return null;
}

function buildSuggestedName(inputName, similarName) {
  const info = parseVersionInfo(similarName);
  const normalizedInput = normalizeName(stripTaskSuffix(inputName));

  if (info) {
    const nextVer = (info.version || 0) + 1;
    if (info.style === 'version') {
      return `${info.base}_version${nextVer}`;
    }
    return `${info.base}_v${nextVer}`;
  }

  const base =
    normalizedInput.replace(/[-_]+$/, '') || normalizeName(stripTaskSuffix(similarName));
  return `${base}_v1`;
}

function getSuggestedName(inputName, historyList, taskType) {
  const normalizedInput = normalizeName(stripTaskSuffix(inputName));
  if (!normalizedInput) return '';

  const taskSuffix = TASK_SUFFIX[taskType] || '';
  const candidates = historyList
    .map((s) => s.session_name)
    .filter(Boolean)
    .filter((n) => n.toLowerCase().endsWith(taskSuffix))
    .map((n) => stripTaskSuffix(n));

  let bestName = '';
  let bestScore = 0;

  candidates.forEach((name) => {
    const score = prefixSimilarity(normalizedInput, name);
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  });

  if (!bestName || bestScore < 0.35) return '';
  return buildSuggestedName(inputName, bestName);
}


const VERSION_SUFFIX_RE = /(_v\d+|_version\d+)$/i;

export function useSessionNameSuggestion(taskType = 'classification') {
  const [sessionName, setSessionName] = useState('');
  const [historyList, setHistoryList] = useState([]);
  const [isDuplicateName, setIsDuplicateName] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');
  const [isSuffixInvalid, setIsSuffixInvalid] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await getTrainingHistory();
        setHistoryList(res.data?.sessions || []);
      } catch (err) {
        console.error('Failed to load training history', err);
      }
    }
    loadHistory();
  }, []);

  const sessionNameWithTask = useMemo(
    () => ensureTaskSuffix(sessionName, taskType),
    [sessionName, taskType]
  );

  const handleSessionNameChange = useCallback(
    (eOrValue) => {
      const valueRaw =
        typeof eOrValue === 'string' ? eOrValue : eOrValue.target.value;

      const value = stripTaskSuffix(valueRaw);

      setSessionName(value);


      const finalName = ensureTaskSuffix(value, taskType);
      const normalizedFinal = normalizeName(finalName);

      const existingNames = historyList
        .map((s) => s.session_name)
        .filter(Boolean)
        .map((n) => normalizeName(n));

      const isDup = existingNames.includes(normalizedFinal);
      setIsDuplicateName(isDup);

      const baseNoTask = stripTaskSuffix(value).trim();
      const suffixOk = VERSION_SUFFIX_RE.test(baseNoTask);
      setIsSuffixInvalid(!suffixOk);

      const suggestion = getSuggestedName(value, historyList, taskType);

      setSuggestedName(suggestion && !isDup ? suggestion : '');
    },
    [historyList, taskType]
  );

  const applySuggestedName = useCallback(() => {
    if (!suggestedName) return;
    setSessionName(suggestedName); 
    setIsDuplicateName(false);

  }, [suggestedName]);

  return {
    sessionName: sessionNameWithTask,  
    rawSessionName: sessionName,       
    isDuplicateName,
    suggestedName: suggestedName
      ? ensureTaskSuffix(suggestedName, taskType) 
      : '',
    isSuffixInvalid,
    handleSessionNameChange,
    applySuggestedName,
  };
}
