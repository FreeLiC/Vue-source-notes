/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

/**
 * Vue源码学习：instance/index.js 中调用
 * 主要初始化Vue
 * @param Vue
 */
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    /**
     * Vue源码学习:传递的是Vue实例 缓存Vue实例的this
     * @type {Vue}
     */
    const vm: Component = this
    // a uid
    vm._uid = uid++

    /**
     * Vue源码学习:标签的开始与结束，主要用于测算性能
     */
    let startTag, endTag
    /* istanbul ignore if */
    /**
     * Vue源码学习: 非生产环境且config.performance为true且存在mark函数
     * 标记开始于结束标签
     */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    /**
     * Vue源码学习：一个标志，以避免被观察到
     * @type {boolean}
     * @private
     */
    vm._isVue = true
    // merge options
    /**
     * Vue源码学习：new Vue 创建实例的时候执行
     * 如果存在options且是以组件形式
     * 合并options
     */
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      /**
       * Vue源码学习：不是组件形式
       * @type {Object}
       */
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**
 *  初始化内部组件
 * @param vm
 * @param options
 */
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 解决构造函数选项
 * Ctor:vm.constructor
 * 经过initGlobalAPI执行后Vue.$options
 * Vue.options = {
    components: {
      KeepAlive,
      Transition,
      TransitionGroup
    },
    directives: {
      model,
      show
    },
    filters: {},
    _base: Vue
  }
 * @param Ctor
 * @returns {Object}
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  /**
   * Vue.options
   * @type {Object}
   */
  let options = Ctor.options
  /**
   * 主要用于处理继承,递归处理
   */
  if (Ctor.super) {
    /**
     * 继承的options
     * @type {Object}
     */
    const superOptions = resolveConstructorOptions(Ctor.super)
    /**
     * 缓存继承的options
     * 如果有继承人的options 第一次必定执行进入下面的if判断
     * 因为Ctor.superOptions 为undefined（只为第一次的情况）
     * @type {Object}
     */
    const cachedSuperOptions = Ctor.superOptions
    /**
     * 通过缓存机制判断继承的options是否等于缓存的options
     */
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      /**
       * 继承的options有变化
       * 赋值Ctor.superOptions为superOptions
       * @type {Object}
       */
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      /**
       * 检查是否有任何后期修改/附加的选项
       * @type {?Object}
       */
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  /**
   * 不存在继承的情况下 直接返回options
   */
  return options
}

/**
 * 检查是否有任何后期修改/附加的选项处理方法
 * @param Ctor
 * @returns {*}
 */
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
