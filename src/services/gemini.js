import { logEvent } from './logger';

const isEmptyOrSchemaResponse = (result) => {
    if (!result) return true;
    
    if (typeof result === 'string') {
        const trimmed = result.trim();
        return trimmed === '' || trimmed === '{}' || trimmed === '[]' || trimmed === 'null';
    }
    
    if (typeof result === 'object') {
        // Check for empty array
        if (Array.isArray(result) && result.length === 0) return true;
        
        // Check for empty object
        const keys = Object.keys(result);
        if (keys.length === 0) return true;
        
        // Check for JSON Schema signature (has 'type' and 'properties' or 'items')
        if (result.type === 'object' && (result.properties || result.required)) {
            return true;
        }
        if (result.type === 'array' && result.items) {
            return true;
        }
        
        // Check if all fields are empty arrays/objects/strings
        let allEmpty = true;
        for (const key of keys) {
            const val = result[key];
            if (val !== null && val !== undefined) {
                if (Array.isArray(val) && val.length > 0) {
                    allEmpty = false;
                } else if (typeof val === 'object' && Object.keys(val).length > 0) {
                    allEmpty = false;
                } else if (typeof val === 'string' && val.trim().length > 0) {
                    allEmpty = false;
                } else if (typeof val === 'number' || typeof val === 'boolean') {
                    allEmpty = false;
                }
            }
        }
        if (allEmpty) return true;
    }
    
    return false;
};

export const generateGeminiContent = async (prompt, systemInstruction, isJson = true, signal = null, onFallback = null) => {
    // Log AI Request initiation
    logEvent('AI_REQUEST', { 
        prompt: prompt.length > 2000 ? prompt.substring(0, 2000) + '... (truncated)' : prompt,
        systemInstruction: systemInstruction?.length > 1000 ? systemInstruction.substring(0, 1000) + '... (truncated)' : systemInstruction,
        isJson
    }, 'info');
    
    const delays = [1000, 2000, 4000]; // Exponential backoff for network/transient errors
    
    for (let i = 0; i < delays.length; i++) {
        if (signal?.aborted) {
            logEvent('AI_CANCELLED', { message: 'AI request aborted by user' }, 'warning');
            throw new Error('Cancelled');
        }
        
        try {
            const syncId = localStorage.getItem('vinyasBitsatSyncId') || '';
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, systemInstruction, isJson, syncId }),
                signal
            });
            
            // Extract attempts header for console logging if present
            const attemptsHeader = response.headers.get('x-gemini-attempts');
            if (attemptsHeader) {
                try {
                    const attempts = JSON.parse(attemptsHeader);
                    attempts.forEach(att => {
                        if (att.status !== 200) {
                            logEvent('AI_WARNING', { 
                                message: `API Key index ${att.index} failed (Status: ${att.status})`, 
                                keyIndex: att.index, 
                                error: att.error 
                            }, 'warning');
                        }
                    });
                } catch (e) {
                    console.error("Failed to parse x-gemini-attempts header", e);
                }
            }
            
            if (!response.ok) {
                let errData = {};
                try {
                    errData = await response.json();
                } catch (e) {
                    // response is not json
                }
                
                if (errData.exhausted) {
                    logEvent('AI_ERROR', { message: 'ALL_KEYS_EXHAUSTED', error: 'All Gemini API keys are rate-limited or exhausted on the server.' }, 'error');
                    throw new Error('ALL_KEYS_EXHAUSTED');
                }
                
                throw new Error(errData.error || errData.details || `API Error ${response.status}`);
            }
            
            const result = isJson ? await response.json() : await response.text();
            
            // Verify if the result is empty or JSON schema
            if (isJson && isEmptyOrSchemaResponse(result)) {
                logEvent('AI_EMPTY_RESPONSE', { 
                    message: 'Empty response or JSON schema returned from AI instead of data.',
                    response: result 
                }, 'warning');
                throw new Error('EMPTY_OR_SCHEMA_RESPONSE');
            }
            
            // Log AI success response
            logEvent('AI_RESPONSE', { 
                message: 'Successfully generated AI content',
                response: typeof result === 'object' ? result : { text: result?.substring(0, 2000) }
            }, 'success');
            
            return result;
        } catch (error) {
            if (error.name === 'AbortError' || error.message === 'Cancelled') {
                logEvent('AI_CANCELLED', { message: 'AI request aborted by user' }, 'warning');
                throw error;
            }
            if (error.message === 'ALL_KEYS_EXHAUSTED') {
                throw error;
            }
            
            console.error("Gemini API Error:", error);
            
            if (i === delays.length - 1) {
                logEvent('AI_ERROR', { message: 'AI_REQUEST_FAILED', error: error.message }, 'error');
                throw error;
            }
            
            logEvent('AI_RETRY_WARNING', { 
                message: `AI request failed, retrying after delay`, 
                delay: delays[i], 
                error: error.message 
            }, 'warning');
            
            if (onFallback) {
                onFallback(`Request failed, retrying... (Attempt ${i + 1}/${delays.length})`);
            }
            
            await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
    }
};
