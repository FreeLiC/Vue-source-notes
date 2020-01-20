/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
/**
 * 选项覆盖策略是处理的功能
 * 如何合并父选项值和子选项
 * 将值转换为最终值。
 * @type {any | {[p: string]: Function}}
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
/**
 * 有限制的选项
 * 如果不为生产环境
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    /**
     * 如果不存在vm实例报错
     */
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
/**
 * 递归地将两个数据对象合并在一起的Helper。
 * @param to
 * @param from
 * @returns {Object}
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
/**
 * 添加指令(directives)、组件(components)、过滤器(filters)等选项的合并策略函数
 * @param parentVal
 * @param childVal
 * @param vm
 * @param key
 * @returns {Object|null|*}
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
/**
 * 默认策略。
 * 默认的合并策略，如果有 `childVal` 则返回 `childVal` 没有则返回 `parentVal`
 * @param parentVal
 * @param childVal
 * @returns {*}
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
/**
 * 验证组件名称
 * @param options
 */
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

/**
 * 检查Components名称
 * @param name
 */
export function validateComponentName (name: string) {
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    /**
     * 无效的组件名称:组件名称应符合html5规范中的有效自定义元素名称。
     */
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  /**
   * 检查是否为内置标签或者检查标签是否已保留，以便无法将其注册为零件,这与平台有关，可能会被覆盖。
   */
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    /**
     * 请勿将内置或保留的HTML元素用作组件名称
     */
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
/**
 * 确保将所有props选项语法标准化
 * 基于对象的格式。
 * @param options
 * @param vm
 */
function normalizeProps (options: Object, vm: ?Component) {
  /**
   * props
   * @type {{}}
   */
  const props = options.props
  /**
   * 不存在props直接返回
   */
  if (!props) return
  const res = {}
  let i, val, name
  /**
   * 如果props为数组
   */
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      /**
       * 检查props是否为字符串，不为字符串则报warn
       */
      if (typeof val === 'string') {
        /**
         * 将props转换为驼峰命名法
         */
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    /**
     * 如果props为对象
     * 循环遍历
     */
    for (const key in props) {
      val = props[key]
      /**
       * 将props转换为驼峰命名法
       */
      name = camelize(key)
      /**
       * 如果值为对象 直接赋值 否则创造对象赋值
       */
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    /**
     * 既不为对象也不为数组 报Warn
     */
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  /**
   * 返回options.props
   * @type {{}}
   */
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
/**
 * 将所有注入标准化为基于对象的格式
 * @param options
 * @param vm
 */
function normalizeInject (options: Object, vm: ?Component) {
  /**
   * 处理注入
   * 缓存注入
   * @type {{}}
   */
  const inject = options.inject
  /**
   * 不存在直接返回
   */
  if (!inject) return
  /**
   * 处理后的序列化的inject
   * @type {{}}
   */
  const normalized = options.inject = {}
  /**
   * 如果inject为数组
   */
  if (Array.isArray(inject)) {
    /**
     * 循环遍历
     */
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    /**
     * 如果为对象，循环遍历
     */
    for (const key in inject) {
      /**
       * 缓存inject的值
       */
      const val = inject[key]
      /**
       * 赋值序列化的值 如果值为对象
       * 合并对象
       * 否则直接返回
       */
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    /**
     * 非生产环境，报warn
     */
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
/**
 * 将原始函数指令规范化为对象格式。
 * @param options
 */
function normalizeDirectives (options: Object) {
  /**
   * 获取options的指令信息
   */
  const dirs = options.directives
  /**
   * 只有在存在指令信息才执行
   */
  if (dirs) {
    /**
     * 对指令信息进行遍历
     */
    for (const key in dirs) {
      /**
       * 缓存指令信息
       */
      const def = dirs[key]
      /**
       * 如果指令为函数,
       * 认为这里只处理了原型上的自定义指令 model和show
       */
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
/**
 * 将两个选项对象合并到一个新的对象中
 * 在实例化和继承中都使用的核心实用程序。
 * @param parent 存在继承或非继承的options
 * @param child  new Vue的对象
 * {
     el: '#app',
     data: {
       a: 1,
       b: [1, 2, 3]
     }
    },
 * @param vm     Vue的实例
 * @returns {{}}
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  /**
   * 如果不为生产环境 检查Components
   */
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  /**
   * 如果data 是函数
   */
  if (typeof child === 'function') {
    child = child.options
  }

  /**
   * 确保将所有props选项语法标准化
   */
  normalizeProps(child, vm)
  /**
   * 将所有注入标准化为基于对象的格式
   */
  normalizeInject(child, vm)
  /**
   * 将原始函数指令规范化为对象格式。
   */
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  /**
   * 在子选项上应用扩展和混合，
   * 但仅当它是原始选项对象而不是
   * 另一个mergeOptions调用的结果。
   * 只有合并的选项才具有_base属性。
   */
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
