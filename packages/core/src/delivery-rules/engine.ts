/**
 * Delivery Rules Engine
 * Evaluates delivery rules against order context and returns results
 * No external dependencies - pure TypeScript implementation
 */

import {
  DeliveryRuleCondition,
  DeliveryRuleAction,
  DeliveryRuleData,
  RuleEvaluationContext,
  RuleResult,
  ConditionOperator,
  EvaluationOptions,
  ActionParams,
} from "./types";

/**
 * Rule Engine - Core evaluation logic
 */
export class RuleEngine {
  /**
   * Evaluate multiple rules against a context
   * @param rules Array of rules to evaluate
   * @param context Order/customer context for evaluation
   * @param options Evaluation options
   * @returns Combined result from all matching rules
   */
  evaluate(
    rules: DeliveryRuleData[],
    context: RuleEvaluationContext,
    options: EvaluationOptions = {},
  ): RuleResult {
    const {
      mode = "highest-priority",
      includeAllMatches = false,
      stopOnBlock = true,
    } = options;

    // Sort rules by priority (lower number = higher priority)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    const matchedRules: DeliveryRuleData[] = [];
    let result: RuleResult = {
      allowed: true,
      appliedRuleIds: [],
    };

    for (const rule of sortedRules) {
      if (!rule.enabled) {
        continue;
      }

      // Check if all conditions match
      const conditionsMatch = this.evaluateConditions(rule.conditions, context);

      if (conditionsMatch) {
        matchedRules.push(rule);

        if (mode === "first-match") {
          // Apply actions and return immediately
          result = this.applyActions(rule.actions, context, result, rule.id);
          return result;
        }

        if (mode === "highest-priority") {
          // Apply actions from highest priority rule only
          result = this.applyActions(rule.actions, context, result, rule.id);
          break;
        }

        if (mode === "all-match") {
          // Apply actions from all matching rules
          result = this.applyActions(rule.actions, context, result, rule.id);

          // Stop if blocked
          if (stopOnBlock && !result.allowed) {
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Evaluate all conditions in a rule
   * @param conditions Array of conditions to check
   * @param context Context for evaluation
   * @returns True if all conditions match
   */
  evaluateConditions(
    conditions: DeliveryRuleCondition[],
    context: RuleEvaluationContext,
  ): boolean {
    // Empty conditions = always true
    if (!conditions || conditions.length === 0) {
      return true;
    }

    // All conditions must be true (AND logic)
    return conditions.every((condition) =>
      this.evaluateCondition(condition, context),
    );
  }

  /**
   * Evaluate a single condition
   * @param condition Condition to evaluate
   * @param context Context for evaluation
   * @returns True if condition matches
   */
  evaluateCondition(
    condition: DeliveryRuleCondition,
    context: RuleEvaluationContext,
  ): boolean {
    const value = this.getContextValue(condition.field, context);

    return this.compare(value, condition.operator, condition.value);
  }

  /**
   * Get a value from context using dot notation
   * @param path Dot notation path (e.g., 'order.weight')
   * @param context Context object
   * @returns Value at path or undefined
   */
  private getContextValue(
    path: string,
    context: RuleEvaluationContext,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Compare a value against another using the specified operator
   * @param value Value to compare
   * @param operator Comparison operator
   * @param compareValue Value to compare against
   * @returns True if comparison succeeds
   */
  private compare(
    value: unknown,
    operator: ConditionOperator,
    compareValue: unknown,
  ): boolean {
    switch (operator) {
      case "eq":
        return value === compareValue;

      case "neq":
        return value !== compareValue;

      case "gt":
        return Number(value) > Number(compareValue);

      case "gte":
        return Number(value) >= Number(compareValue);

      case "lt":
        return Number(value) < Number(compareValue);

      case "lte":
        return Number(value) <= Number(compareValue);

      case "in":
        return Array.isArray(compareValue)
          ? compareValue.includes(value)
          : false;

      case "notIn":
        return Array.isArray(compareValue)
          ? !compareValue.includes(value)
          : true;

      case "between": {
        if (!Array.isArray(compareValue) || compareValue.length !== 2) {
          return false;
        }
        const [min, max] = compareValue;
        const num = Number(value);
        return num >= Number(min) && num <= Number(max);
      }

      case "contains":
        return String(value).includes(String(compareValue));

      case "startsWith":
        return String(value).startsWith(String(compareValue));

      case "endsWith":
        return String(value).endsWith(String(compareValue));

      default:
        return false;
    }
  }

  /**
   * Apply rule actions to modify the result
   * @param actions Actions to apply
   * @param context Evaluation context
   * @param currentResult Current result to modify
   * @param ruleId ID of rule being applied
   * @returns Updated result
   */
  private applyActions(
    actions: DeliveryRuleAction[],
    context: RuleEvaluationContext,
    currentResult: RuleResult,
    ruleId: string,
  ): RuleResult {
    if (!actions || actions.length === 0) {
      return currentResult;
    }

    const result = { ...currentResult };

    // Track which rule applied actions
    if (!result.appliedRuleIds) {
      result.appliedRuleIds = [];
    }
    result.appliedRuleIds.push(ruleId);

    // Sort actions by priority
    const sortedActions = [...actions].sort(
      (a, b) => (a.priority || 100) - (b.priority || 100),
    );

    for (const action of sortedActions) {
      this.applyAction(action, result);
    }

    return result;
  }

  /**
   * Apply a single action
   * @param action Action to apply
   * @param result Result object to modify
   */
  private applyAction(action: DeliveryRuleAction, result: RuleResult): void {
    const { type, params } = action;

    switch (type) {
      case "SET_RATE":
        if (params.rate !== undefined) {
          result.rate = params.rate;
        }
        break;

      case "BLOCK":
        result.allowed = false;
        result.message = params.reason || "Delivery not available";
        break;

      case "APPLY_DISCOUNT":
        if (params.discount !== undefined) {
          result.discount = params.discount;
        }
        break;

      case "ADD_FEE":
        if (params.fee !== undefined) {
          result.fee = (result.fee || 0) + params.fee;
        }
        break;

      case "SET_TIME_SLOT":
        if (params.timeSlots) {
          result.timeSlots = params.timeSlots;
        }
        break;

      case "REQUIRE_SIGNATURE":
        result.requiresSignature = true;
        break;

      case "MARK_FRAGILE":
        result.isFragile = true;
        if (params.riskLevel) {
          result.riskLevel = params.riskLevel;
        }
        break;

      default:
        // Unknown action type - skip
        break;
    }
  }

  /**
   * Validate rule structure
   * @param rule Rule to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateRule(rule: DeliveryRuleData): string[] {
    const errors: string[] = [];

    if (!rule.id) {
      errors.push("Rule must have an id");
    }

    if (!rule.shopId) {
      errors.push("Rule must have a shopId");
    }

    if (!rule.name) {
      errors.push("Rule must have a name");
    }

    if (!rule.type || !["LOCAL", "PICKUP", "STANDARD"].includes(rule.type)) {
      errors.push("Rule must have a valid type (LOCAL, PICKUP, STANDARD)");
    }

    if (rule.priority < 0 || !Number.isInteger(rule.priority)) {
      errors.push("Rule priority must be a non-negative integer");
    }

    return errors;
  }
}

/**
 * Export singleton instance
 */
export const ruleEngine = new RuleEngine();
