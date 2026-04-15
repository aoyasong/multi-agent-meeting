import { describe, expect, it, vi } from 'vitest';

import pluginEntry from '../../src/index.js';
import { createMockApi } from '../helpers/test-helpers.js';

describe('Plugin registration contract', () => {
  it('should expose a valid plugin entry and register 32 tools', () => {
    const registerTool = vi.fn();
    const registerCommand = vi.fn();
    const loggerInfo = vi.fn();
    const api = createMockApi({
      registerTool,
      registerCommand,
      logger: {
        info: loggerInfo,
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    });

    expect(pluginEntry.id).toBe('multi-agent-meeting-plugin');
    expect(pluginEntry.name).toBe('Multi-Agent Meeting Plugin');
    expect(typeof pluginEntry.register).toBe('function');

    pluginEntry.register(api);

    expect(registerTool).toHaveBeenCalledTimes(32);

    const registeredTools = registerTool.mock.calls.map(call => call[0]);
    for (const tool of registeredTools) {
      expect(tool).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }

    expect(registerCommand).toHaveBeenCalledTimes(5);

    expect(loggerInfo).toHaveBeenCalledWith('Meeting plugin registered with 32 tools and 5 commands');
  });
});
