/**
 * Telecom & Email Validation Utility for Ethiopian Telecommunications & Standard Mail
 * Supports Ethio Telecom (09/2519), Safaricom Ethiopia (07/2517) and Strict RFC Email Validation
 */

// Common standard Top-Level Domains (TLDs) and Ethiopian ccTLDs
const VALID_TLD_REGEX = /^([a-z]{2,10}|gov\.et|edu\.et|org\.et|net\.et|com\.et|co\.uk|org\.uk|co\.ke|com\.ng)$/i;

// Known invalid / common typo TLDs that standard regexes accidentally accept
const KNOWN_TYPO_TLDS = new Set([
  'coms', 'comm', 'con', 'cm', 'coom', 'xom', 'cpm', 'vom',
  'orgs', 'og', 'orgg',
  'nett', 'ne', 'nt',
  'gmaill', 'gmai', 'gmil',
  'ets', 'ett',
]);

/**
 * Validates and strictly normalizes an Ethiopian or international mobile phone number
 * @param {string} phone Raw phone number string
 * @param {object} options Validation options { mode: 'ethiopia_only'|'all', allowedOperators: ['ethio_telecom', 'safaricom'] }
 * @returns {{ isValid: boolean, normalized: string, operator: string, error?: string }}
 */
export const validateAndNormalizeEthiopianPhone = (phone, options = {}) => {
  const mode = options.mode || 'ethiopia_only';
  const allowedOperators = options.allowedOperators || ['ethio_telecom', 'safaricom'];

  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '', operator: 'Unknown', error: 'Phone number is empty or not provided.' };
  }

  // Strip spaces, hyphens, parentheses, dots
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  // Handle leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Handle local 0-prefixed Ethiopian numbers: e.g. 0911223344 or 0712345678 -> 2519... / 2517...
  if (/^0[97]\d{8}$/.test(cleaned)) {
    cleaned = '251' + cleaned.substring(1);
  }

  // Check Ethio Telecom (2519XXXXXXXX)
  const isEthioTelecom = /^2519\d{8}$/.test(cleaned);
  // Check Safaricom Ethiopia (2517XXXXXXXX)
  const isSafaricom = /^2517\d{8}$/.test(cleaned);

  if (isEthioTelecom) {
    if (!allowedOperators.includes('ethio_telecom')) {
      return {
        isValid: false,
        normalized: cleaned,
        operator: 'Ethio Telecom',
        error: 'Ethio Telecom numbers (09 / +2519) are disabled in gateway policy.',
      };
    }
    return {
      isValid: true,
      normalized: cleaned,
      formatted: `+251 ${cleaned.substring(3, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`,
      operator: 'Ethio Telecom (09)',
    };
  }

  if (isSafaricom) {
    if (!allowedOperators.includes('safaricom')) {
      return {
        isValid: false,
        normalized: cleaned,
        operator: 'Safaricom Ethiopia',
        error: 'Safaricom numbers (07 / +2517) are disabled in gateway policy.',
      };
    }
    return {
      isValid: true,
      normalized: cleaned,
      formatted: `+251 ${cleaned.substring(3, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`,
      operator: 'Safaricom Ethiopia (07)',
    };
  }

  // If in international mode, allow standard E.164 (7-15 digits)
  if (mode === 'all' && /^\d{7,15}$/.test(cleaned)) {
    return {
      isValid: true,
      normalized: cleaned,
      formatted: `+${cleaned}`,
      operator: 'International',
    };
  }

  return {
    isValid: false,
    normalized: '',
    operator: 'Unknown',
    error: `Invalid Ethiopian mobile number: "${phone}". Must be a valid Ethio Telecom (09...) or Safaricom Ethiopia (07...) 10-digit number (e.g. 0911223344 or +251911223344).`,
  };
};

/**
 * Strict RFC 5322 and TLD-validating email validator
 * Rejects typos like .coms, .con, malformed domains, and non-existent TLDs
 * @param {string} email Raw email address
 * @param {object} options Validation options { allowedDomains: [] }
 * @returns {{ isValid: boolean, normalized: string, domain: string, error?: string }}
 */
export const validateEmailAddress = (email, options = {}) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, normalized: '', domain: '', error: 'Email address is empty or not provided.' };
  }

  const trimmed = email.trim().toLowerCase();

  // Basic RFC 5322 structure
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, normalized: '', domain: '', error: `Invalid email address format: "${email}".` };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, normalized: '', domain: '', error: `Malformed email address: "${email}".` };
  }

  const domain = parts[1];
  const domainParts = domain.split('.');

  if (domainParts.length < 2) {
    return { isValid: false, normalized: '', domain, error: `Email domain "${domain}" must have a valid extension (e.g. .gov.et or .com).` };
  }

  // Extract TLD (or compound ccTLD like gov.et)
  const lastPart = domainParts[domainParts.length - 1];
  const compoundTld = domainParts.slice(-2).join('.');

  // Check known typo TLDs
  if (KNOWN_TYPO_TLDS.has(lastPart) || KNOWN_TYPO_TLDS.has(compoundTld)) {
    return {
      isValid: false,
      normalized: '',
      domain,
      error: `Invalid email domain extension ".${lastPart}" in "${email}". Did you mean ".com" or ".et"?`,
    };
  }

  // Validate TLD length and characters
  if (!VALID_TLD_REGEX.test(lastPart) && !VALID_TLD_REGEX.test(compoundTld)) {
    return {
      isValid: false,
      normalized: '',
      domain,
      error: `Unrecognized email top-level domain ".${lastPart}" in "${email}".`,
    };
  }

  // If domain whitelist is specified in options
  if (Array.isArray(options.allowedDomains) && options.allowedDomains.length > 0) {
    const isDomainAllowed = options.allowedDomains.some((d) => {
      const cleanD = d.trim().toLowerCase().replace(/^@/, '');
      return domain === cleanD || domain.endsWith('.' + cleanD);
    });

    if (!isDomainAllowed) {
      return {
        isValid: false,
        normalized: '',
        domain,
        error: `Domain "@${domain}" is not in the approved organization email domains list.`,
      };
    }
  }

  return {
    isValid: true,
    normalized: trimmed,
    domain,
  };
};
