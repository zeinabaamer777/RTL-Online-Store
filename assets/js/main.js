//  plugins 
/**
 * jQuery || Zepto Parallax Plugin
 * @author Matthew Wagerfield - @wagerfield
 * @description Creates a parallax effect between an array of layers,
 *              driving the motion from the gyroscope output of a smartdevice.
 *              If no gyroscope is available, the cursor position is used.
 */
;(function($, window, document, undefined) {

  // Strict Mode
  'use strict';

  // Constants
  var NAME = 'parallax';
  var MAGIC_NUMBER = 30;
  var DEFAULTS = {
    relativeInput: false,
    clipRelativeInput: false,
    calibrationThreshold: 100,
    calibrationDelay: 500,
    supportDelay: 500,
    calibrateX: false,
    calibrateY: true,
    invertX: true,
    invertY: true,
    limitX: false,
    limitY: false,
    scalarX: 10.0,
    scalarY: 10.0,
    frictionX: 0.1,
    frictionY: 0.1,
    originX: 0.5,
    originY: 0.5,
    pointerEvents: true,
    precision: 1
  };

  function Plugin(element, options) {

    // DOM Context
    this.element = element;

    // Selections
    this.$context = $(element).data('api', this);
    this.$layers = this.$context.find('.layer');

    // Data Extraction
    var data = {
      calibrateX: this.$context.data('calibrate-x') || null,
      calibrateY: this.$context.data('calibrate-y') || null,
      invertX: this.$context.data('invert-x') || null,
      invertY: this.$context.data('invert-y') || null,
      limitX: parseFloat(this.$context.data('limit-x')) || null,
      limitY: parseFloat(this.$context.data('limit-y')) || null,
      scalarX: parseFloat(this.$context.data('scalar-x')) || null,
      scalarY: parseFloat(this.$context.data('scalar-y')) || null,
      frictionX: parseFloat(this.$context.data('friction-x')) || null,
      frictionY: parseFloat(this.$context.data('friction-y')) || null,
      originX: parseFloat(this.$context.data('origin-x')) || null,
      originY: parseFloat(this.$context.data('origin-y')) || null,
      pointerEvents: this.$context.data('pointer-events') || true,
      precision: parseFloat(this.$context.data('precision')) || 1
    };

    // Delete Null Data Values
    for (var key in data) {
      if (data[key] === null) delete data[key];
    }

    // Compose Settings Object
    $.extend(this, DEFAULTS, options, data);

    // States
    this.calibrationTimer = null;
    this.calibrationFlag = true;
    this.enabled = false;
    this.depthsX = [];
    this.depthsY = [];
    this.raf = null;

    // Element Bounds
    this.bounds = null;
    this.ex = 0;
    this.ey = 0;
    this.ew = 0;
    this.eh = 0;

    // Element Center
    this.ecx = 0;
    this.ecy = 0;

    // Element Range
    this.erx = 0;
    this.ery = 0;

    // Calibration
    this.cx = 0;
    this.cy = 0;

    // Input
    this.ix = 0;
    this.iy = 0;

    // Motion
    this.mx = 0;
    this.my = 0;

    // Velocity
    this.vx = 0;
    this.vy = 0;

    // Callbacks
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onDeviceOrientation = this.onDeviceOrientation.bind(this);
    this.onOrientationTimer = this.onOrientationTimer.bind(this);
    this.onCalibrationTimer = this.onCalibrationTimer.bind(this);
    this.onAnimationFrame = this.onAnimationFrame.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);

    // Initialise
    this.initialise();
  }

  Plugin.prototype.transformSupport = function(value) {
    var element = document.createElement('div');
    var propertySupport = false;
    var propertyValue = null;
    var featureSupport = false;
    var cssProperty = null;
    var jsProperty = null;
    for (var i = 0, l = this.vendors.length; i < l; i++) {
      if (this.vendors[i] !== null) {
        cssProperty = this.vendors[i][0] + 'transform';
        jsProperty = this.vendors[i][1] + 'Transform';
      } else {
        cssProperty = 'transform';
        jsProperty = 'transform';
      }
      if (element.style[jsProperty] !== undefined) {
        propertySupport = true;
        break;
      }
    }
    switch(value) {
      case '2D':
        featureSupport = propertySupport;
        break;
      case '3D':
        if (propertySupport) {
          var body = document.body || document.createElement('body');
          var documentElement = document.documentElement;
          var documentOverflow = documentElement.style.overflow;
          var isCreatedBody = false;
          if (!document.body) {
            isCreatedBody = true;
            documentElement.style.overflow = 'hidden';
            documentElement.appendChild(body);
            body.style.overflow = 'hidden';
            body.style.background = '';
          }
          body.appendChild(element);
          element.style[jsProperty] = 'translate3d(1px,1px,1px)';
          propertyValue = window.getComputedStyle(element).getPropertyValue(cssProperty);
          featureSupport = propertyValue !== undefined && propertyValue.length > 0 && propertyValue !== "none";
          documentElement.style.overflow = documentOverflow;
          body.removeChild(element);
          if ( isCreatedBody ) {
            body.removeAttribute('style');
            body.parentNode.removeChild(body);
          }
        }
        break;
    }
    return featureSupport;
  };

  Plugin.prototype.ww = null;
  Plugin.prototype.wh = null;
  Plugin.prototype.wcx = null;
  Plugin.prototype.wcy = null;
  Plugin.prototype.wrx = null;
  Plugin.prototype.wry = null;
  Plugin.prototype.portrait = null;
  Plugin.prototype.desktop = !navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i);
  Plugin.prototype.vendors = [null,['-webkit-','webkit'],['-moz-','Moz'],['-o-','O'],['-ms-','ms']];
  Plugin.prototype.motionSupport = !!window.DeviceMotionEvent;
  Plugin.prototype.orientationSupport = !!window.DeviceOrientationEvent;
  Plugin.prototype.orientationStatus = 0;
  Plugin.prototype.transform2DSupport = Plugin.prototype.transformSupport('2D');
  Plugin.prototype.transform3DSupport = Plugin.prototype.transformSupport('3D');
  Plugin.prototype.propertyCache = {};

  Plugin.prototype.initialise = function() {

    // Configure Styles
    if (this.$context.css('position') === 'static') {
      this.$context.css({
        position:'relative'
      });
    }

    // Pointer events
    if(!this.pointerEvents){
      this.$context.css({
        pointerEvents: 'none'
      });
    }

    // Hardware Accelerate Context
    this.accelerate(this.$context);

    // Setup
    this.updateLayers();
    this.updateDimensions();
    this.enable();
    this.queueCalibration(this.calibrationDelay);
  };

  Plugin.prototype.updateLayers = function() {

    // Cache Layer Elements
    this.$layers = this.$context.find('.layer');
    this.depthsX = [];
    this.depthsY = [];

    // Configure Layer Styles
    this.$layers.css({
      position:'absolute',
      display:'block',
      left: 0,
      top: 0
    });
    this.$layers.first().css({
      position:'relative'
    });

    // Hardware Accelerate Layers
    this.accelerate(this.$layers);

    // Cache Depths
    this.$layers.each($.proxy(function(index, element) {
      //Graceful fallback on depth if depth-x or depth-y is absent
      var depth = $(element).data('depth') || 0;
      this.depthsX.push($(element).data('depth-x') || depth);
      this.depthsY.push($(element).data('depth-y') || depth);
    }, this));
  };

  Plugin.prototype.updateDimensions = function() {
    this.ww = window.innerWidth;
    this.wh = window.innerHeight;
    this.wcx = this.ww * this.originX;
    this.wcy = this.wh * this.originY;
    this.wrx = Math.max(this.wcx, this.ww - this.wcx);
    this.wry = Math.max(this.wcy, this.wh - this.wcy);
  };

  Plugin.prototype.updateBounds = function() {
    this.bounds = this.element.getBoundingClientRect();
    this.ex = this.bounds.left;
    this.ey = this.bounds.top;
    this.ew = this.bounds.width;
    this.eh = this.bounds.height;
    this.ecx = this.ew * this.originX;
    this.ecy = this.eh * this.originY;
    this.erx = Math.max(this.ecx, this.ew - this.ecx);
    this.ery = Math.max(this.ecy, this.eh - this.ecy);
  };

  Plugin.prototype.queueCalibration = function(delay) {
    clearTimeout(this.calibrationTimer);
    this.calibrationTimer = setTimeout(this.onCalibrationTimer, delay);
  };

  Plugin.prototype.enable = function() {
    if (!this.enabled) {
      this.enabled = true;
      if (this.orientationSupport) {
        this.portrait = null;
        window.addEventListener('deviceorientation', this.onDeviceOrientation);
        setTimeout(this.onOrientationTimer, this.supportDelay);
      } else {
        this.cx = 0;
        this.cy = 0;
        this.portrait = false;
        window.addEventListener('mousemove', this.onMouseMove);
      }
      window.addEventListener('resize', this.onWindowResize);
      this.raf = requestAnimationFrame(this.onAnimationFrame);
    }
  };

  Plugin.prototype.disable = function() {
    if (this.enabled) {
      this.enabled = false;
      if (this.orientationSupport) {
        window.removeEventListener('deviceorientation', this.onDeviceOrientation);
      } else {
        window.removeEventListener('mousemove', this.onMouseMove);
      }
      window.removeEventListener('resize', this.onWindowResize);
      cancelAnimationFrame(this.raf);
    }
  };

  Plugin.prototype.calibrate = function(x, y) {
    this.calibrateX = x === undefined ? this.calibrateX : x;
    this.calibrateY = y === undefined ? this.calibrateY : y;
  };

  Plugin.prototype.invert = function(x, y) {
    this.invertX = x === undefined ? this.invertX : x;
    this.invertY = y === undefined ? this.invertY : y;
  };

  Plugin.prototype.friction = function(x, y) {
    this.frictionX = x === undefined ? this.frictionX : x;
    this.frictionY = y === undefined ? this.frictionY : y;
  };

  Plugin.prototype.scalar = function(x, y) {
    this.scalarX = x === undefined ? this.scalarX : x;
    this.scalarY = y === undefined ? this.scalarY : y;
  };

  Plugin.prototype.limit = function(x, y) {
    this.limitX = x === undefined ? this.limitX : x;
    this.limitY = y === undefined ? this.limitY : y;
  };

  Plugin.prototype.origin = function(x, y) {
    this.originX = x === undefined ? this.originX : x;
    this.originY = y === undefined ? this.originY : y;
  };

  Plugin.prototype.clamp = function(value, min, max) {
    value = Math.max(value, min);
    value = Math.min(value, max);
    return value;
  };

  Plugin.prototype.css = function(element, property, value) {
    var jsProperty = this.propertyCache[property];
    if (!jsProperty) {
      for (var i = 0, l = this.vendors.length; i < l; i++) {
        if (this.vendors[i] !== null) {
          jsProperty = $.camelCase(this.vendors[i][1] + '-' + property);
        } else {
          jsProperty = property;
        }
        if (element.style[jsProperty] !== undefined) {
          this.propertyCache[property] = jsProperty;
          break;
        }
      }
    }
    element.style[jsProperty] = value;
  };

  Plugin.prototype.accelerate = function($element) {
    for (var i = 0, l = $element.length; i < l; i++) {
      var element = $element[i];
      this.css(element, 'transform', 'translate3d(0,0,0)');
      this.css(element, 'transform-style', 'preserve-3d');
      this.css(element, 'backface-visibility', 'hidden');
    }
  };

  Plugin.prototype.setPosition = function(element, x, y) {
    x += 'px';
    y += 'px';
    if (this.transform3DSupport) {
      this.css(element, 'transform', 'translate3d('+x+','+y+',0)');
    } else if (this.transform2DSupport) {
      this.css(element, 'transform', 'translate('+x+','+y+')');
    } else {
      element.style.left = x;
      element.style.top = y;
    }
  };

  Plugin.prototype.onOrientationTimer = function(event) {
    if (this.orientationSupport && this.orientationStatus === 0) {
      this.disable();
      this.orientationSupport = false;
      this.enable();
    }
  };

  Plugin.prototype.onCalibrationTimer = function(event) {
    this.calibrationFlag = true;
  };

  Plugin.prototype.onWindowResize = function(event) {
    this.updateDimensions();
  };

  Plugin.prototype.onAnimationFrame = function() {
    this.updateBounds();
    var dx = this.ix - this.cx;
    var dy = this.iy - this.cy;
    if ((Math.abs(dx) > this.calibrationThreshold) || (Math.abs(dy) > this.calibrationThreshold)) {
      this.queueCalibration(0);
    }
    if (this.portrait) {
      this.mx = this.calibrateX ? dy : this.iy;
      this.my = this.calibrateY ? dx : this.ix;
    } else {
      this.mx = this.calibrateX ? dx : this.ix;
      this.my = this.calibrateY ? dy : this.iy;
    }
    this.mx *= this.ew * (this.scalarX / 100);
    this.my *= this.eh * (this.scalarY / 100);
    if (!isNaN(parseFloat(this.limitX))) {
      this.mx = this.clamp(this.mx, -this.limitX, this.limitX);
    }
    if (!isNaN(parseFloat(this.limitY))) {
      this.my = this.clamp(this.my, -this.limitY, this.limitY);
    }
    this.vx += (this.mx - this.vx) * this.frictionX;
    this.vy += (this.my - this.vy) * this.frictionY;
    for (var i = 0, l = this.$layers.length; i < l; i++) {
      var depthX = this.depthsX[i];
      var depthY = this.depthsY[i];
      var layer = this.$layers[i];
      var xOffset = this.vx * (depthX * (this.invertX ? -1 : 1));
      var yOffset = this.vy * (depthY * (this.invertY ? -1 : 1));
      this.setPosition(layer, xOffset, yOffset);
    }
    this.raf = requestAnimationFrame(this.onAnimationFrame);
  };

  Plugin.prototype.onDeviceOrientation = function(event) {

    // Validate environment and event properties.
    if (!this.desktop && event.beta !== null && event.gamma !== null) {

      // Set orientation status.
      this.orientationStatus = 1;

      // Extract Rotation
      var x = (event.beta  || 0) / MAGIC_NUMBER; //  -90 :: 90
      var y = (event.gamma || 0) / MAGIC_NUMBER; // -180 :: 180

      // Detect Orientation Change
      var portrait = window.innerHeight > window.innerWidth;
      if (this.portrait !== portrait) {
        this.portrait = portrait;
        this.calibrationFlag = true;
      }

      // Set Calibration
      if (this.calibrationFlag) {
        this.calibrationFlag = false;
        this.cx = x;
        this.cy = y;
      }

      // Set Input
      this.ix = x;
      this.iy = y;
    }
  };

  Plugin.prototype.onMouseMove = function(event) {

    // Cache mouse coordinates.
    var clientX = event.clientX;
    var clientY = event.clientY;

    // Calculate Mouse Input
    if (!this.orientationSupport && this.relativeInput) {

      // Clip mouse coordinates inside element bounds.
      if (this.clipRelativeInput) {
        clientX = Math.max(clientX, this.ex);
        clientX = Math.min(clientX, this.ex + this.ew);
        clientY = Math.max(clientY, this.ey);
        clientY = Math.min(clientY, this.ey + this.eh);
      }

      // Calculate input relative to the element.
      this.ix = (clientX - this.ex - this.ecx) / this.erx;
      this.iy = (clientY - this.ey - this.ecy) / this.ery;

    } else {

      // Calculate input relative to the window.
      this.ix = (clientX - this.wcx) / this.wrx;
      this.iy = (clientY - this.wcy) / this.wry;
    }
  };

  var API = {
    enable: Plugin.prototype.enable,
    disable: Plugin.prototype.disable,
    updateLayers: Plugin.prototype.updateLayers,
    calibrate: Plugin.prototype.calibrate,
    friction: Plugin.prototype.friction,
    invert: Plugin.prototype.invert,
    scalar: Plugin.prototype.scalar,
    limit: Plugin.prototype.limit,
    origin: Plugin.prototype.origin
  };

  $.fn[NAME] = function (value) {
    var args = arguments;
    return this.each(function () {
      var $this = $(this);
      var plugin = $this.data(NAME);
      if (!plugin) {
        plugin = new Plugin(this, value);
        $this.data(NAME, plugin);
      }
      if (API[value]) {
        plugin[value].apply(plugin, Array.prototype.slice.call(args, 1));
      }
    });
  };

})(window.jQuery || window.Zepto, window, document);


/* ================================================
---------------------- Main.js ----------------- */
(function ($) {
  'use strict';
  var Porto = {
    initialised: false,
    mobile: false,
    init: function () {

      if (!this.initialised) {
        this.initialised = true;
      }
      else {
        return;
      }

      // Call Porto Functions
      this.checkMobile();
      this.stickyHeader();
      this.headerSearchToggle();
      this.mMenuIcons();
      this.mMenuToggle();
      this.mobileMenu();
      this.scrollToTop();
      this.quantityInputs();
      this.countTo();
      this.tooltip();
      this.popover();
      this.changePassToggle();
      this.changeBillToggle();
      this.catAccordion();
      this.ajaxLoadProduct();
      this.toggleFilter();
      this.toggleSidebar();
      this.productTabSroll();
      this.scrollToElement();
      this.loginPopup();
      this.modalView();
      this.productManage();
      this.ratingTooltip();
      this.windowClick();

      /* Menu via superfish plugin */
      if ($.fn.superfish) {
        this.menuInit();
      }

      /* Call function if Owl Carousel plugin is included */
      if ($.fn.owlCarousel) {
        this.owlCarousels();
      }

      /* Call function if noUiSlider plugin is included - for category pages */
      if (typeof noUiSlider === 'object') {
        this.filterSlider();
      }

      /* Call if not mobile and plugin is included */
      if ($.fn.themeSticky) {
        this.stickySidebar();
      }

      /* Call function if Light Gallery plugin is included */
      if ($.fn.magnificPopup) {
        this.lightBox();
      }

      /* Word rotate if Morphext plugin is included */
      if ($.fn.Morphext) {
        this.wordRotate();
      }

    },
    checkMobile: function () {
      /* Mobile Detect*/
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        this.mobile = true;
      }
      else {
        this.mobile = false;
      }
    },
    menuInit: function () {
      // Main Menu init with superfish plugin
      $('.menu').superfish({
        popUpSelector: 'ul, .megamenu',
        hoverClass: 'show',
        delay: 0,
        speed: 80,
        speedOut: 80,
        autoArrows: true
      });
    },
    stickyHeader: function () {
      // Sticky header - calls if sticky-header class is added to the header
      if ($('.sticky-header').length) {
        var sticky = new Waypoint.Sticky({
          element: $('.sticky-header')[0],
          stuckClass: 'fixed',
          offset: -10
        });
      }

      //Set sticky headers in main part
      $('main').find('.sticky-header').each(function () {
        var sticky = new Waypoint.Sticky({
          element: $(this),
          stuckClass: 'fixed-nav',
        });
      });
    },
    headerSearchToggle: function () {
      // Search Dropdown Toggle
      $('.search-toggle').on('click', function (e) {
        $('.header-search-wrapper').toggleClass('show');
        e.preventDefault();
      });

      $('body').on('click', function (e) {
        if ($('.header-search-wrapper').hasClass('show')) {
          $('.header-search-wrapper').removeClass('show');
          $('body').removeClass('is-search-active');
        }
      });

      $('.header-search').on('click', function (e) {
        e.stopPropagation();
      });
    },
    mMenuToggle: function () {
      // Mobile Menu Show/Hide
      $('.mobile-menu-toggler').on('click', function (e) {
        $('body').toggleClass('mmenu-active');
        $(this).toggleClass('active');
        e.preventDefault();
      });

      $('.mobile-menu-overlay, .mobile-menu-close').on('click', function (e) {
        $('body').removeClass('mmenu-active');
        $('.menu-toggler').removeClass('active');
        e.preventDefault();
      });
    },
    mMenuIcons: function () {
      // Add Mobile menu icon arrows or plus/minus to items with children
      $('.mobile-menu').find('li').each(function () {
        var $this = $(this);

        if ($this.find('ul').length) {
          $('<span/>', {
            'class': 'mmenu-btn'
          }).appendTo($this.children('a'));
        }
      });
    },
    mobileMenu: function () {
      // Mobile Menu Toggle
      $('.mmenu-btn').on('click', function (e) {
        var $parent = $(this).closest('li'),
          $targetUl = $parent.find('ul').eq(0);

        if (!$parent.hasClass('open')) {
          $targetUl.slideDown(300, function () {
            $parent.addClass('open');
          });
        }
        else {
          $targetUl.slideUp(300, function () {
            $parent.removeClass('open');
          });
        }

        e.stopPropagation();
        e.preventDefault();
      });
    },
   
    owlCarousels: function () {
      var sliderDefaultOptions = {
        loop: true,
        margin: 0,
        responsiveClass: true,
        nav: false,
        navText: ['<i class="icon-angle-left">', '<i class="icon-angle-right">'],
        dots: true,
        autoplay: true,
        autoplayTimeout: 15000,
        items: 1,
      };

      // Init all carousel
      $('[data-toggle="owl"]').each(function () {
        
        var pluginOptions = $(this).data('owl-options');

        if (typeof pluginOptions == 'string') {
          pluginOptions = JSON.parse(pluginOptions.replace(/'/g,'"').replace(';',''));
        }

        var  newOwlSettings = $.extend(true, {}, sliderDefaultOptions, pluginOptions);

        var owlIns = $(this).owlCarousel(newOwlSettings);
      });

      /* Hom Slider */
      var homeSlider = $('.home-slider');

      homeSlider.owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        lazyLoad: true,
        dotsContainer: ".home-slider-thumbs",
        autoplay: false,
        animateOut: 'fadeOut'
      }));
      jQuery('.home-slider ul.scene').parallax();

      homeSlider.on('loaded.owl.lazy', function (event) {
        $(event.element).closest('.home-slide').addClass('loaded');
      });

      $('.home-slider-thumbs').find('a').on('click', function (e) {
        var $this = $(this);

        if (!$this.hasClass('active')) {
          var index = $this.index();
          homeSlider.trigger('to.owl.carousel', [index]);
          $this.addClass('active').siblings().removeClass('active');
        }

        e.preventDefault();
      });

      // Home - Featured products
      $('.featured-products').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        loop: false,
        margin: 20,
        autoplay: false,
        responsive: {
          0: {
            items: 2
          },
          480: {
            items: 2
          },
          768: {
            items: 3
          },
          992: {
            items: 5
          },
          1200: {
            items: 6
          }
        }
      }));

      /* Widget Featurd Products*/
      $('.widget-featured-products').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        lazyLoad: true,
        nav: true,
        dots: false,
        autoHeight: true
      }));

      // Home - Product section slider
      $('.product-section-slider').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        lazyLoad: true,
        autoplay: false,
        animateOut: 'fadeOut'
      }));
      $('.product-section-slider').on('loaded.owl.lazy', function (event) {
        $(event.element).closest('.product-section-slide').addClass('loaded');
      });

      // Home - Products Slider
      $('.products-slider').each(function () {
        $(this).owlCarousel($.extend(true, {}, sliderDefaultOptions, {
          margin: 30,
          lazyLoad: true,
          nav: true,
          dots: false,
          responsive: {
            0: {
              items: 2
            },
            480: {
              items: 2
            },
            768: {
              items: 1
            },
            992: {
              items: 2
            }
          }
        }));
      });

      // About - Testimonials slider
      $('.testimonials-slider').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        nav: true,
        navText: ['<i class="icon-left-open-big">', '<i class="icon-right-open-big">'],
        dots: false,
      }));

      // Entry Slider - Blog page
      $('.entry-slider').each(function () {
        $(this).owlCarousel($.extend(true, {}, sliderDefaultOptions, {
          margin: 2,
          lazyLoad: true,
        }));
      });

      // Related posts
      $('.related-posts-carousel').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        loop: false,
        margin: 30,
        responsive: {
          0: {
            items: 1
          },
          480: {
            items: 2
          },
          1200: {
            items: 3
          }
        }
      }));

      //Category boxed slider
      $('.boxed-slider').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        lazyLoad: true,
        navText: ['<i class="icon-left-open-big">', '<i class="icon-right-open-big">'],
        autoplayTimeout: 20000,
        animateOut: 'fadeOut'
      }));
      $('.boxed-slider').on('loaded.owl.lazy', function (event) {
        $(event.element).closest('.category-slide').addClass('loaded');
      });

      /* Product single carousel - extenden product */
      $('.product-single-default .product-single-carousel').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        nav: true,
        dotsContainer: '#carousel-custom-dots',
        autoplay: false,
        onInitialized: function () {
          var $source = this.$element;

          if ($.fn.elevateZoom) {
            $source.find('img').each(function () {
              var $this = $(this),
                zoomConfig = {
                  responsive: true,
                  zoomWindowFadeIn: 350,
                  zoomWindowFadeOut: 200,
                  borderSize: 0,
                  zoomContainer: $this.parent(),
                  zoomType: 'inner',
                  cursor: 'grab'
                };
              $this.elevateZoom(zoomConfig);
            });
          }
        },
      }));

      $('.product-single-extended .product-single-carousel').owlCarousel($.extend(true, {}, sliderDefaultOptions, {
        dots: false,
        autoplay: false,
        responsive: {
          0: {
            items: 1
          },
          480: {
            items: 2
          },
          1200: {
            items: 3
          }
        }
      }));

      $('#carousel-custom-dots .owl-dot').click(function () {
        $('.product-single-carousel').trigger('to.owl.carousel', [$(this).index(), 300]);
      });
    },
    filterSlider: function () {
      // Slider For category pages / filter price
      var priceSlider = document.getElementById('price-slider'),
        currencyVar = '$';

      // Check if #price-slider elem is exists if not return
      // to prevent error logs
      if (priceSlider == null) return;

      noUiSlider.create(priceSlider, {
        start: [200, 700],
        connect: true,
        step: 100,
        margin: 100,
        range: {
          'min': 0,
          'max': 1000
        }
      });

      // Update Price Range
      priceSlider.noUiSlider.on('update', function (values, handle) {
        var values = values.map(function (value) {
          return currencyVar + value;
        })
        $('#filter-price-range').text(values.join(' - '));
      });
    },
    stickySidebar: function () {
      $(".sidebar-wrapper, .sticky-slider").themeSticky({
        autoInit: true,
        minWidth: 991,
        containerSelector: '.row, .container',
        autoFit: true,
        paddingOffsetBottom: 10,
        paddingOffsetTop: 60
      });
    },
    countTo: function () {
      // CountTo plugin used count animations for homepages
      if ($.fn.countTo) {
        if ($.fn.waypoint) {
          $('.count').waypoint(function () {
            $(this.element).countTo();
          }, {
              offset: '90%',
              triggerOnce: true
            });
        }
        else {
          $('.count').countTo();
        }
      }
      else {
        // fallback if count plugin doesn't included
        // Get the data-to value and add it to element
        $('.count').each(function () {
          var $this = $(this),
            countValue = $this.data('to');
          $this.text(countValue);
        });
      }
    },
    tooltip: function () {
      // Bootstrap Tooltip
      if ($.fn.tooltip) {
        $('[data-toggle="tooltip"]').tooltip({
          trigger: 'hover focus' // click can be added too
        });
      }
    },
    popover: function () {
      // Bootstrap Popover
      if ($.fn.popover) {
        $('[data-toggle="popover"]').popover({
          trigger: 'focus'
        });
      }
    },
    changePassToggle: function () {
      // Toggle new/change password section via checkbox
      $('#change-pass-checkbox').on('change', function () {
        $('#account-chage-pass').toggleClass('show');
      });
    },
    changeBillToggle: function () {
      // Checkbox review - billing address checkbox
      $('#change-bill-address').on('change', function () {
        $('#checkout-shipping-address').toggleClass('show');
        $('#new-checkout-address').toggleClass('show');
      });
    },
    catAccordion: function () {
      // Toggle "open" Class for parent elem - Home cat widget
      $('.catAccordion').on('shown.bs.collapse', function (item) {
        var parent = $(item.target).closest('li');

        if (!parent.hasClass('open')) {
          parent.addClass('open');
        }
      }).on('hidden.bs.collapse', function (item) {
        var parent = $(item.target).closest('li');

        if (parent.hasClass('open')) {
          parent.removeClass('open');
        }
      });
    },
    scrollBtnAppear: function () {
      if ($(window).scrollTop() >= 400) {
        $('#scroll-top').addClass('fixed');
      }
      else {
        $('#scroll-top').removeClass('fixed');
      }
    },
    scrollToTop: function () {
      $('#scroll-top').on('click', function (e) {
        $('html, body').animate({
          'scrollTop': 0
        }, 1200);
        e.preventDefault();
      });
    },
    newsletterPopup: function() {
      $.magnificPopup.open({
        items: {
          src: '#newsletter-popup-form'
        },
        type: 'inline',
        mainClass: 'mfp-newsletter',
        removalDelay: 350
      });
    },
    lightBox: function () {
      // Newsletter popup
      if ( document.getElementById('newsletter-popup-form') ) {
        setTimeout(function() {
          var mpInstance = $.magnificPopup.instance;
          if (mpInstance.isOpen) {
            mpInstance.close();
            setTimeout(function() {
              Porto.newsletterPopup();
            },360);
          }
          else {
            Porto.newsletterPopup();
          }
        }, 10000);
      }

      // Gallery Lightbox
      var links = [];
      var $productSliderImages = $('.product-single-carousel .owl-item:not(.cloned) img').length === 0 ? $('.product-single-gallery img') : $('.product-single-carousel .owl-item:not(.cloned) img');
      $productSliderImages.each(function () {
        links.push({ 'src': $(this).attr('data-zoom-image') });
      });

      $(".prod-full-screen").click(function (e) {
        var currentIndex;
        if (e.currentTarget.closest(".product-slider-container")) {
          currentIndex = ($('.product-single-carousel').data('owl.carousel').current() + $productSliderImages.length - Math.ceil($productSliderImages.length / 2)) % $productSliderImages.length;
        }
        else {
          currentIndex = $(e.currentTarget).closest(".product-item").index();
        }

        $.magnificPopup.open({
          items: links,
          navigateByImgClick: true,
          type: 'image',
          gallery: {
            enabled: true
          },
        }, currentIndex);
      });

      //QuickView Popup
      $('body').on('click', 'a.btn-quickview', function (e) {
        e.preventDefault();
        Porto.ajaxLoading();
        var ajaxUrl = $(this).attr('href');
        setTimeout(function () {
          $.magnificPopup.open({
            type: 'ajax',
            mainClass: "mfp-ajax-product",
            tLoading: '',
            preloader: false,
            removalDelay: 350,
            items: {
              src: ajaxUrl
            },
            callbacks: {
              open: function() {
                if($('.sticky-header.fixed').css('margin-right')) {
                  var newMargin = Number($('.sticky-header.fixed').css('margin-right').slice(0, -2))+17+'px';

                  $('.sticky-header.fixed').css('margin-right', newMargin);
                  $('.sticky-header.fixed-nav').css('margin-right', newMargin);
                  $('#scroll-top').css('margin-right', newMargin);
                }
              },
              ajaxContentAdded: function () {
                Porto.owlCarousels();
                Porto.quantityInputs();
                if (typeof addthis !== 'undefined') {
                  addthis.layers.refresh();
                }
                else {
                  $.getScript("https://s7.addthis.com/js/300/addthis_widget.js#pubid=ra-5b927288a03dbde6");
                }
              },
              beforeClose: function () {
                $('.ajax-overlay').remove();
              },
              afterClose: function() {
                if($('.sticky-header.fixed').css('margin-right')) {
                  var newMargin = Number($('.sticky-header.fixed').css('margin-right').slice(0, -2))-17+'px';

                  $('.sticky-header.fixed').css('margin-right', newMargin);
                  $('.sticky-header.fixed-nav').css('margin-right', newMargin);
                  $('#scroll-top').css('margin-right', newMargin);
                }
              }
            },
            ajax: {
              tError: '',
            }
          });
        }, 500);
      });
    },
    productTabSroll: function () {
      // Scroll to product details tab and show review tab - product pages
      $('.rating-link').on('click', function (e) {
        if ($('.product-single-tabs').length) {
          $('#product-tab-reviews').tab('show');
        }
        else if ($('.product-single-collapse').length) {
          $('#product-reviews-content').collapse('show');
        }
        else {
          return;
        }

        if ($('#product-reviews-content').length) {
          setTimeout(function () {
            var scrollTabPos = $('#product-reviews-content').offset().top - 60;

            $('html, body').stop().animate({
              'scrollTop': scrollTabPos
            }, 800);
          }, 250);
        }
        e.preventDefault();
      });
    },
    quantityInputs: function () {
      // Quantity input - cart - product pages
      if ($.fn.TouchSpin) {
        // Vertical Quantity
        $('.vertical-quantity').TouchSpin({
          verticalbuttons: true,
          verticalup: '',
          verticaldown: '',
          verticalupclass: 'icon-up-dir',
          verticaldownclass: 'icon-down-dir',
          buttondown_class: 'btn btn-outline',
          buttonup_class: 'btn btn-outline',
          initval: 1,
          min: 1
        });

        // Horizontal Quantity
        $('.horizontal-quantity').TouchSpin({
          verticalbuttons: false,
          buttonup_txt: '',
          buttondown_txt: '',
          buttondown_class: 'btn btn-outline btn-down-icon',
          buttonup_class: 'btn btn-outline btn-up-icon',
          initval: 1,
          min: 1
        });
      }
    },
    ajaxLoading: function () {
      $('body').append("<div class='ajax-overlay'><i class='porto-loading-icon'></i></div>");
    },
    wordRotate: function () {
      $('.word-rotater').each(function () {
        $(this).Morphext({
          animation: 'bounceIn',
          separator: ',',
          speed: 2000
        });
      });
    },
    ajaxLoadProduct: function () {
      var loadCount = 0;
      $loadButton.click(function (e) {
        e.preventDefault();
        $(this).text('Loading ...');
        $.ajax({
          url: "ajax/category-ajax-products.html",
          success: function (result) {
            var $newItems = $(result);
            setTimeout(function () {
              $newItems.hide().appendTo('.product-ajax-grid').fadeIn();
              $loadButton.text('Load More');
              loadCount++;
              if (loadCount >= 2) {
                $loadButton.hide();
              }
            }, 350);
          },
          failure: function () {
            $loadButton.text("Sorry something went wrong.");
          }
        });
      });
    },
    toggleFilter: function () {
      // toggle sidebar filter
      $('.filter-toggle a').click(function (e) {
        e.preventDefault();
        $('.filter-toggle').toggleClass('opened');
        $('main').toggleClass('sidebar-opened');
      });

      // hide sidebar filter and sidebar overlay
      $('.sidebar-overlay').click(function (e) {
        $('.filter-toggle').removeClass('opened');
        $('main').removeClass('sidebar-opened');
      });

      // show/hide sort menu
      $('.sort-menu-trigger').click(function (e) {
        e.preventDefault();
        $('.select-custom').removeClass('opened');
        $(e.target).closest('.select-custom').toggleClass('opened');
      });
    },
    toggleSidebar: function () {
      $('.sidebar-toggle').click(function () {
        $('main').toggleClass('sidebar-opened');
      });
    },
    scrollToElement: function () {
      $('.scrolling-box a[href^="#"]').on('click', function (event) {
        var target = $(this.getAttribute('href'));

        if (target.length) {
          event.preventDefault();
          $('html, body').stop().animate({
            scrollTop: target.offset().top - 90
          }, 700);
        }
      });
    },
    loginPopup: function () {
      $('.login-link').click(function (e) {
        e.preventDefault();
        Porto.ajaxLoading();
        var ajaxUrl = "ajax/login-popup.html";
        setTimeout(function () {
          $.magnificPopup.open({
            type: 'ajax',
            mainClass: "login-popup",
            tLoading: '',
            preloader: false,
            removalDelay: 350,
            items: {
              src: ajaxUrl
            },
            callbacks: {
              open: function() {
                var newMargin = Number($('.sticky-header.fixed').css('margin-right').slice(0, -2))+17+'px';

                $('.sticky-header.fixed').css('margin-right', newMargin);
                $('.sticky-header.fixed-nav').css('margin-right', newMargin);
                $('#scroll-top').css('margin-right', newMargin);
              },
              beforeClose: function () {
                $('.ajax-overlay').remove();
              },
              afterClose: function() {
                var newMargin = Number($('.sticky-header.fixed').css('margin-right').slice(0, -2))-17+'px';

                $('.sticky-header.fixed').css('margin-right', newMargin);
                $('.sticky-header.fixed-nav').css('margin-right', newMargin);
                $('#scroll-top').css('margin-right', newMargin);                
              }
            },
            ajax: {
              tError: '',
            }
          });
        }, 1500);
      });
    },
    modalView: function() {
      $('body').on('click', '.btn-add-cart', function(e){
        $('.add-cart-box #productImage').attr('src', $(this).parents('.product-default').find('figure img').attr('src'));
        $('.add-cart-box #productTitle').text($(this).parents('.product-default').find('.product-title').text());

        if($('.sticky-header.fixed').css('margin-right')) {
          var newMargin = Number($('.sticky-header.fixed').css('margin-right').slice(0, -2))+17+'px';

          $('.sticky-header.fixed').css('margin-right', newMargin);
          $('.sticky-header.fixed-nav').css('margin-right', newMargin);
          $('#scroll-top').css('margin-right', newMargin);
        }
      });
      $('.modal#addCartModal').on('hidden.bs.modal', function(e){
        if($('.sticky-header.fixed').css('margin-right')) {
          var newMargin = Number($('.sticky-header.fixed').css('margin-right').slice(0, -2))-17+'px';

          $('.sticky-header.fixed').css('margin-right', newMargin);
          $('.sticky-header.fixed-nav').css('margin-right', newMargin);
          $('#scroll-top').css('margin-right', newMargin);
        }
      })
    },
    productManage: function () {
      $('.product-select').click(function(e) {
        $(this).parents('.product-default').find('figure img').attr('src', $(this).data('src'));
        $(this).addClass('checked').siblings().removeClass('checked');
      });
    },
    ratingTooltip: function () {
      $('.product-ratings').hover(function(e) {
        var ratingsRes = $(this).find('.ratings').width() / $(this).width() * 5;
        $(this).find('.tooltiptext').text(ratingsRes?ratingsRes.toFixed(2):ratingsRes);
      });
    },
    windowClick: function () {
      $(document).click(function (e) {
        // if click is happend outside of filter menu, hide it.
        if (!$(e.target).closest('.toolbox-item.select-custom').length) {
          $('.select-custom').removeClass('opened');
        }
      });
    }
  };

  $('body').prepend('<div class="loading-overlay"><div class="bounce-loader"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div></div>');

  //Variables
  var $loadButton = $('.loadmore .btn');

  // Ready Event
  jQuery(document).ready(function () {
    // Init our app
    Porto.init();
  });

  // Load Event
  $(window).on('load', function () {
    $('body').addClass("loaded");
    Porto.scrollBtnAppear();
  });

  // Scroll Event
  $(window).on('scroll', function () {
    Porto.scrollBtnAppear();
  });

  

})(jQuery);