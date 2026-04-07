import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Delivery Rules Engine Tests
 * Tests all operators, rule priority, matching modes, and action application
 */

// Types for the delivery rules engine
interface Condition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between' | 'contains';
  value: any;
}

interface Rule {
  id: string;
  name: string;
  priority: number;
  conditions: Condition[];
  matchMode: 'first' | 'all';
  action: {
    type: 'shipping_method' | 'discount' | 'add_fee';
    payload: Record<string, any>;
  };
  active: boolean;
}

interface Context {
  weight: number;
  distance: number;
  zipCode: string;
  destination: string;
  orderValue: number;
  urgency?: string;
  region?: string;
}

class DeliveryRulesEngine {
  private rules: Rule[] = [];

  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  private evaluateCondition(condition: Condition, context: Context): boolean {
    const contextValue = (context as any)[condition.field];

    switch (condition.operator) {
      case 'eq':
        return contextValue === condition.value;
      case 'neq':
        return contextValue !== condition.value;
      case 'gt':
        return contextValue > condition.value;
      case 'gte':
        return contextValue >= condition.value;
      case 'lt':
        return contextValue < condition.value;
      case 'lte':
        return contextValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'between':
        return (
          Array.isArray(condition.value) &&
          contextValue >= condition.value[0] &&
          contextValue <= condition.value[1]
        );
      case 'contains':
        if (typeof contextValue === 'string' && typeof condition.value === 'string') {
          return contextValue.includes(condition.value);
        }
        if (Array.isArray(contextValue)) {
          return contextValue.includes(condition.value);
        }
        return false;
      default:
        return false;
    }
  }

  private ruleMatches(rule: Rule, context: Context): boolean {
    if (!rule.active) return false;

    if (rule.matchMode === 'all') {
      return rule.conditions.every(cond => this.evaluateCondition(cond, context));
    } else {
      // 'first' mode - match on first matching condition
      return rule.conditions.length > 0 && this.evaluateCondition(rule.conditions[0], context);
    }
  }

  private getActiveSortedRules(): Rule[] {
    return [...this.rules]
      .filter(r => r.active)
      .sort((a, b) => b.priority - a.priority);
  }

  evaluateRules(context: Context, matchMode: 'first' | 'all' = 'first'): Rule[] {
    const sortedRules = this.getActiveSortedRules();

    if (matchMode === 'first') {
      const matched = sortedRules.find(rule => this.ruleMatches(rule, context));
      return matched ? [matched] : [];
    } else {
      return sortedRules.filter(rule => this.ruleMatches(rule, context));
    }
  }

  applyActions(rules: Rule[]): Record<string, any>[] {
    return rules.map(rule => ({
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action.type,
      payload: rule.action.payload,
    }));
  }
}

describe('DeliveryRulesEngine', () => {
  let engine: DeliveryRulesEngine;
  let testContext: Context;

  beforeEach(() => {
    engine = new DeliveryRulesEngine();
    testContext = {
      weight: 5,
      distance: 50,
      zipCode: '10001',
      destination: 'manhattan',
      orderValue: 100,
      urgency: 'normal',
      region: 'ny',
    };
  });

  describe('Operators - Equality', () => {
    it('should evaluate eq operator correctly', () => {
      const rule: Rule = {
        id: 'eq-test',
        name: 'Test Eq',
        priority: 1,
        conditions: [{ field: 'destination', operator: 'eq', value: 'manhattan' }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'standard' } },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
      expect(matched[0].id).toBe('eq-test');
    });

    it('should fail eq when values do not match', () => {
      const rule: Rule = {
        id: 'eq-fail',
        name: 'Test Eq Fail',
        priority: 1,
        conditions: [{ field: 'destination', operator: 'eq', value: 'brooklyn' }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should evaluate neq operator correctly', () => {
      const rule: Rule = {
        id: 'neq-test',
        name: 'Test Neq',
        priority: 1,
        conditions: [{ field: 'destination', operator: 'neq', value: 'brooklyn' }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });
  });

  describe('Operators - Comparison', () => {
    it('should evaluate gt operator correctly', () => {
      const rule: Rule = {
        id: 'gt-test',
        name: 'Test Gt',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 3 }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: { fee: 10 } },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });

    it('should fail gt when value is not greater', () => {
      const rule: Rule = {
        id: 'gt-fail',
        name: 'Test Gt Fail',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 10 }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should evaluate gte operator correctly', () => {
      const rule: Rule = {
        id: 'gte-test',
        name: 'Test Gte',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gte', value: 5 }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });

    it('should evaluate lt operator correctly', () => {
      const rule: Rule = {
        id: 'lt-test',
        name: 'Test Lt',
        priority: 1,
        conditions: [{ field: 'distance', operator: 'lt', value: 100 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });

    it('should evaluate lte operator correctly', () => {
      const rule: Rule = {
        id: 'lte-test',
        name: 'Test Lte',
        priority: 1,
        conditions: [{ field: 'distance', operator: 'lte', value: 50 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });
  });

  describe('Operators - Collections', () => {
    it('should evaluate in operator with array', () => {
      const rule: Rule = {
        id: 'in-test',
        name: 'Test In',
        priority: 1,
        conditions: [
          { field: 'destination', operator: 'in', value: ['manhattan', 'brooklyn', 'queens'] },
        ],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });

    it('should fail in when value not in list', () => {
      const rule: Rule = {
        id: 'in-fail',
        name: 'Test In Fail',
        priority: 1,
        conditions: [{ field: 'destination', operator: 'in', value: ['bronx', 'staten_island'] }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should evaluate between operator correctly', () => {
      const rule: Rule = {
        id: 'between-test',
        name: 'Test Between',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'between', value: [2, 10] }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });

    it('should fail between when value outside range', () => {
      const rule: Rule = {
        id: 'between-fail',
        name: 'Test Between Fail',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'between', value: [1, 3] }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should evaluate contains operator for strings', () => {
      const rule: Rule = {
        id: 'contains-test',
        name: 'Test Contains',
        priority: 1,
        conditions: [{ field: 'zipCode', operator: 'contains', value: '100' }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });
  });

  describe('Rule Priority Ordering', () => {
    it('should return highest priority rule first', () => {
      const lowPriorityRule: Rule = {
        id: 'low',
        name: 'Low Priority',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'low' } },
        active: true,
      };

      const highPriorityRule: Rule = {
        id: 'high',
        name: 'High Priority',
        priority: 100,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'high' } },
        active: true,
      };

      engine.addRule(lowPriorityRule);
      engine.addRule(highPriorityRule);

      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched[0].id).toBe('high');
    });

    it('should respect priority ordering with multiple rules', () => {
      const rules = [
        { id: 'rule1', priority: 10, name: 'Rule 1' },
        { id: 'rule2', priority: 50, name: 'Rule 2' },
        { id: 'rule3', priority: 30, name: 'Rule 3' },
      ];

      rules.forEach(r =>
        engine.addRule({
          ...r,
          conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
          matchMode: 'all',
          action: { type: 'shipping_method', payload: {} },
          active: true,
        })
      );

      const matched = engine.evaluateRules(testContext, 'all');
      expect(matched[0].id).toBe('rule2');
      expect(matched[1].id).toBe('rule3');
      expect(matched[2].id).toBe('rule1');
    });
  });

  describe('Match Modes', () => {
    it('should return only first matching rule in first-match mode', () => {
      const rule1: Rule = {
        id: 'rule1',
        name: 'Rule 1',
        priority: 50,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'first' } },
        active: true,
      };

      const rule2: Rule = {
        id: 'rule2',
        name: 'Rule 2',
        priority: 10,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'second' } },
        active: true,
      };

      engine.addRule(rule1);
      engine.addRule(rule2);

      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
      expect(matched[0].id).toBe('rule1');
    });

    it('should return all matching rules in all-match mode', () => {
      const rule1: Rule = {
        id: 'rule1',
        name: 'Rule 1',
        priority: 50,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      const rule2: Rule = {
        id: 'rule2',
        name: 'Rule 2',
        priority: 10,
        conditions: [{ field: 'weight', operator: 'gte', value: 5 }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: {} },
        active: true,
      };

      engine.addRule(rule1);
      engine.addRule(rule2);

      const matched = engine.evaluateRules(testContext, 'all');
      expect(matched).toHaveLength(2);
    });

    it('should handle first-match condition mode', () => {
      const rule: Rule = {
        id: 'first-match-rule',
        name: 'First Match Rule',
        priority: 1,
        conditions: [
          { field: 'weight', operator: 'lt', value: 2 },
          { field: 'weight', operator: 'gt', value: 0 },
        ],
        matchMode: 'first',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      // First condition fails (weight is 5, not < 2), so rule should not match
      expect(matched).toHaveLength(0);
    });
  });

  describe('Complex Multi-Condition Rules', () => {
    it('should evaluate all conditions with AND logic', () => {
      const rule: Rule = {
        id: 'complex-and',
        name: 'Complex AND Rule',
        priority: 1,
        conditions: [
          { field: 'weight', operator: 'gte', value: 1 },
          { field: 'distance', operator: 'lte', value: 100 },
          { field: 'destination', operator: 'in', value: ['manhattan', 'brooklyn'] },
          { field: 'orderValue', operator: 'gt', value: 50 },
        ],
        matchMode: 'all',
        action: { type: 'discount', payload: { discount: 10 } },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });

    it('should fail if any condition fails in AND logic', () => {
      const rule: Rule = {
        id: 'complex-and-fail',
        name: 'Complex AND Fail',
        priority: 1,
        conditions: [
          { field: 'weight', operator: 'gte', value: 1 },
          { field: 'distance', operator: 'lte', value: 30 }, // This fails
          { field: 'destination', operator: 'in', value: ['manhattan', 'brooklyn'] },
        ],
        matchMode: 'all',
        action: { type: 'discount', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should handle mixed operators in complex rules', () => {
      const rule: Rule = {
        id: 'mixed-ops',
        name: 'Mixed Operators',
        priority: 1,
        conditions: [
          { field: 'weight', operator: 'between', value: [1, 10] },
          { field: 'distance', operator: 'gt', value: 25 },
          { field: 'orderValue', operator: 'gte', value: 100 },
          { field: 'destination', operator: 'neq', value: 'staten_island' },
        ],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'express' } },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(1);
    });
  });

  describe('Inactive Rules', () => {
    it('should ignore inactive rules', () => {
      const activeRule: Rule = {
        id: 'active',
        name: 'Active Rule',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'active' } },
        active: true,
      };

      const inactiveRule: Rule = {
        id: 'inactive',
        name: 'Inactive Rule',
        priority: 100,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: { method: 'inactive' } },
        active: false,
      };

      engine.addRule(inactiveRule);
      engine.addRule(activeRule);

      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched[0].id).toBe('active');
    });
  });

  describe('Action Application', () => {
    it('should apply actions from matched rules', () => {
      const rule: Rule = {
        id: 'action-test',
        name: 'Action Test',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: {
          type: 'shipping_method',
          payload: { method: 'standard', cost: 5.99 },
        },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      const actions = engine.applyActions(matched);

      expect(actions).toHaveLength(1);
      expect(actions[0].ruleId).toBe('action-test');
      expect(actions[0].action).toBe('shipping_method');
      expect(actions[0].payload.method).toBe('standard');
      expect(actions[0].payload.cost).toBe(5.99);
    });

    it('should apply actions from multiple matched rules', () => {
      const rule1: Rule = {
        id: 'discount-rule',
        name: 'Discount Rule',
        priority: 50,
        conditions: [{ field: 'orderValue', operator: 'gte', value: 100 }],
        matchMode: 'all',
        action: { type: 'discount', payload: { percent: 10 } },
        active: true,
      };

      const rule2: Rule = {
        id: 'fee-rule',
        name: 'Fee Rule',
        priority: 30,
        conditions: [{ field: 'weight', operator: 'gte', value: 5 }],
        matchMode: 'all',
        action: { type: 'add_fee', payload: { fee: 2.5 } },
        active: true,
      };

      engine.addRule(rule1);
      engine.addRule(rule2);

      const matched = engine.evaluateRules(testContext, 'all');
      const actions = engine.applyActions(matched);

      expect(actions).toHaveLength(2);
      expect(actions[0].action).toBe('discount');
      expect(actions[1].action).toBe('add_fee');
    });

    it('should return empty actions for no matches', () => {
      const rule: Rule = {
        id: 'no-match',
        name: 'No Match Rule',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 100 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      const actions = engine.applyActions(matched);

      expect(actions).toHaveLength(0);
    });
  });

  describe('Rule Management', () => {
    it('should remove rules by ID', () => {
      const rule: Rule = {
        id: 'remove-me',
        name: 'Remove Me',
        priority: 1,
        conditions: [{ field: 'weight', operator: 'gt', value: 0 }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      engine.removeRule('remove-me');
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty rule set', () => {
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should handle context with missing fields', () => {
      const rule: Rule = {
        id: 'missing-field',
        name: 'Missing Field Rule',
        priority: 1,
        conditions: [{ field: 'unknownField', operator: 'eq', value: 'something' }],
        matchMode: 'all',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });

    it('should handle rules with no conditions', () => {
      const rule: Rule = {
        id: 'no-conditions',
        name: 'No Conditions',
        priority: 1,
        conditions: [],
        matchMode: 'first',
        action: { type: 'shipping_method', payload: {} },
        active: true,
      };

      engine.addRule(rule);
      const matched = engine.evaluateRules(testContext, 'first');
      expect(matched).toHaveLength(0);
    });
  });
});
