﻿import ko from "knockout";
import system from "./system";

/**
 * The binder joins an object instance and a DOM element tree by applying databinding and/or invoking binding lifecycle callbacks (binding and bindingComplete).
 * @module binder
 * @requires knockout
 * @requires system
 */

function BinderModule() {
    let binder;
    const insufficientInfoMessage = "Insufficient Information to Bind";
    const unexpectedViewMessage = "Unexpected View Type";
    const bindingInstructionKey = "durandal-binding-instruction";
    const koBindingContextKey = "__ko_bindingContext__";

    function normalizeBindingInstruction(result) {
        if (result === undefined) {
            return { applyBindings: true };
        }

        if (system.isBoolean(result)) {
            return { applyBindings: result };
        }

        if (result.applyBindings === undefined) {
            result.applyBindings = true;
        }

        return result;
    }

    function doBind(obj, view, bindingTarget, data) {
        if (!view || !bindingTarget) {
            if (binder.throwOnErrors) {
                system.error(insufficientInfoMessage);
            } else {
                system.log(insufficientInfoMessage, view, data);
            }
            return;
        }

        if (!view.getAttribute) {
            if (binder.throwOnErrors) {
                system.error(unexpectedViewMessage);
            } else {
                system.log(unexpectedViewMessage, view, data);
            }
            return;
        }

        try {
            let instruction;

            if (obj && obj.binding) {
                instruction = obj.binding(view);
            }

            instruction = normalizeBindingInstruction(instruction);
            binder.binding(data, view, instruction);

            if (instruction.applyBindings) {
                system.log("Binding", data.modelName, data);
                ko.applyBindings(bindingTarget, view);
            } else if (obj) {
                ko.utils.domData.set(view, koBindingContextKey, { $data: obj });
            }

            binder.bindingComplete(data, view, instruction);

            if (obj && obj.bindingComplete) {
                obj.bindingComplete(view);
            }

            ko.utils.domData.set(view, bindingInstructionKey, instruction);
            return instruction;
        } catch (e) {
            e.message = `${e.message};\nView: ${view.outerHTML};\nModuleId: ${system.getModelName(data)}`;
            if (binder.throwOnErrors) {
                system.error(e);
            } else {
                system.log(e.message);
            }
        }
    }

    /**
     * @class BinderModule
     * @static
     */
    binder = {
        /**
         * Called before every binding operation. Does nothing by default.
         * @method binding
         * @param {object} data The data that is about to be bound.
         * @param {DOMElement} view The view that is about to be bound.
         * @param {object} instruction The object that carries the binding instructions.
         */
        binding: system.noop,
        /**
         * Called after every binding operation. Does nothing by default.
         * @method bindingComplete
         * @param {object} data The data that has just been bound.
         * @param {DOMElement} view The view that has just been bound.
         * @param {object} instruction The object that carries the binding instructions.
         */
        bindingComplete: system.noop,
        /**
         * Indicates whether or not the binding system should throw errors or not.
         * @property {boolean} throwOnErrors
         * @default false The binding system will not throw errors by default. Instead it will log them.
         */
        throwOnErrors: false,
        /**
         * Gets the binding instruction that was associated with a view when it was bound.
         * @method getBindingInstruction
         * @param {DOMElement} view The view that was previously bound.
         * @return {object} The object that carries the binding instructions.
         */
        getBindingInstruction(view) {
            return ko.utils.domData.get(view, bindingInstructionKey);
        },
        /**
         * Binds the view, preserving the existing binding context. Optionally, a new context can be created, parented to the previous context.
         * @method bindContext
         * @param {KnockoutBindingContext} bindingContext The current binding context.
         * @param {DOMElement} view The view to bind.
         * @param {object} [obj] The data to bind to, causing the creation of a child binding context if present.
         * @param {string} [dataAlias] An alias for $data if present.
         */
        bindContext(bindingContext, view, obj, dataAlias) {
            if (obj && bindingContext) {
                bindingContext = bindingContext.createChildContext(
                    obj,
                    typeof dataAlias === "string" ? dataAlias : null
                );
            }

            return doBind(obj, view, bindingContext, obj || (bindingContext ? bindingContext.$data : null));
        },
        /**
         * Binds the view, preserving the existing binding context. Optionally, a new context can be created, parented to the previous context.
         * @method bind
         * @param {object} obj The data to bind to.
         * @param {DOMElement} view The view to bind.
         */
        bind(obj, view) {
            return doBind(obj, view, obj, obj);
        },
    };

    return binder;
}

export default BinderModule();
