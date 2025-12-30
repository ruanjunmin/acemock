import { SearchEngine } from '../types';

// API Keys Management
const STORAGE_PREFIX = 'aceMock_key_';

export type SearchProvider = 'baidu_search1' | 'google_serper' | 'tavily';
export type ShardingMode = 'SERIAL' | 'PARALLEL';

// Helper to get key
export const getSearchKey = (provider: SearchProvider): string => {
    return localStorage.getItem(`${STORAGE_PREFIX}${provider}`) || '';
}

// Helper to set key
export const setSearchKey = (provider: SearchProvider, key: string) => {
    localStorage.setItem(`${STORAGE_PREFIX}${provider}`, key);
}

// --- 性能与限流配置 ---
export const getBatchSize = (): number => {
    const val = localStorage.getItem('aceMock_batch_size');
    return val ? parseInt(val) : 10; // 默认改为 10 题/片
}

export const setBatchSize = (size: number) => {
    localStorage.setItem('aceMock_batch_size', size.toString());
}

export const getRequestDelay = (): number => {
    const val = localStorage.getItem('aceMock_request_delay');
    return val ? parseInt(val) : 1000; // 默认间隔 1000ms
}

export const setRequestDelay = (ms: number) => {
    localStorage.setItem('aceMock_request_delay', ms.toString());
}

export const getShardingMode = (): ShardingMode => {
    const val = localStorage.getItem('aceMock_sharding_mode');
    return (val as ShardingMode) || 'SERIAL'; // 默认串行
}

export const setShardingMode = (mode: ShardingMode) => {
    localStorage.setItem('aceMock_sharding_mode', mode);
}

// Helper to get active global engine
export const getActiveSearchEngine = (): SearchEngine => {
    return (localStorage.getItem('aceMock_active_engine') as SearchEngine) || 'google_native';
}

export const setActiveSearchEngine = (engine: SearchEngine) => {
    localStorage.setItem('aceMock_active_engine', engine);
}

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

/**
 * Searches Baidu using the Search1 API
 */
export const searchBaidu = async (query: string): Promise<SearchResult[]> => {
    const apiKey = getSearchKey('baidu_search1');
    if (!apiKey) {
        console.warn("Baidu API Key not configured");
        return [];
    }

    try {
        const response = await fetch('https://api.search1api.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: query,
                service: "baidu",
                gl: "cn",
                hl: "zh-cn"
            })
        });

        if (!response.ok) {
            console.warn("Search1 API failed");
            return [];
        }

        const data = await response.json();
        const results = data.organic || data.results || [];
        
        return results.slice(0, 5).map((item: any) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet || item.description || ''
        }));

    } catch (error) {
        console.error("Baidu Search Error:", error);
        return [];
    }
};

/**
 * Searches Google using the Serper.dev API
 */
export const searchGoogleSerper = async (query: string): Promise<SearchResult[]> => {
    const apiKey = getSearchKey('google_serper');
    if (!apiKey) {
        console.warn("Serper API Key not configured");
        return [];
    }

    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                gl: "cn",
                hl: "zh-cn"
            })
        });

        if (!response.ok) return [];

        const data = await response.json();
        
        return (data.organic || []).slice(0, 5).map((item: any) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
        }));

    } catch (error) {
        console.error("Serper Search Error:", error);
        return [];
    }
};

/**
 * Searches using Tavily API
 */
export const searchTavily = async (query: string): Promise<SearchResult[]> => {
    const apiKey = getSearchKey('tavily');
    if (!apiKey) {
        console.warn("Tavily API Key not configured");
        return [];
    }
    
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: "basic",
                include_answer: false,
                include_images: false,
                include_raw_content: false,
                max_results: 5
            })
        });

        if (!response.ok) {
            console.warn("Tavily API failed");
            return [];
        }

        const data = await response.json();
        const results = data.results || [];

        return results.map((item: any) => ({
            title: item.title,
            link: item.url,
            snippet: item.content
        }));

    } catch (error) {
        console.error("Tavily Search Error:", error);
        return [];
    }
};

/**
 * Tests connection to a specific provider
 */
export const testSearchConnection = async (provider: SearchProvider, testKey?: string): Promise<boolean> => {
    const keyToUse = testKey || getSearchKey(provider);
    if (!keyToUse) return false;

    try {
        if (provider === 'baidu_search1') {
            const response = await fetch('https://api.search1api.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${keyToUse}`
                },
                body: JSON.stringify({
                    query: "test",
                    service: "baidu"
                })
            });
            return response.ok;
        } else if (provider === 'google_serper') {
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': keyToUse,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: "test"
                })
            });
            return response.ok;
        } else if (provider === 'tavily') {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: keyToUse,
                    query: "test",
                    max_results: 1
                })
            });
            return response.ok;
        }
    } catch (e) {
        console.error("Test connection failed", e);
        return false;
    }
    return false;
};