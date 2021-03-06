import {
  OnInit,
  ComponentFactoryResolver,
  ViewChild,
  Component,
  SimpleChanges,
  ElementRef,
  Input,
  OnChanges,
  ViewContainerRef
} from '@angular/core';
import {setTopLeft, setTopRight, setTransform, setTransformRtl} from '../utils/utils';
import {getDocumentDir} from '../utils/domUtils';
import {FlagDirective} from '../directive/flag.directive';
import {createCoreData, getControlPosition} from '../utils/draggableUtils';
import {EventService} from '../service/event.service';
import * as interactjs from 'interactjs';
import {GridDynamicComponent} from '../grid-dynamic/grid-dynamic.component';
import {DataArray, WidgetType} from '../schema';
import {FormArray, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {RfmenuComponent} from '../widget/rfmenu.component';
import {RfchartComponent} from '../widget/rfchart.component';

@Component({
  selector: 'ngx-grid-item',
  templateUrl: './grid-item.component.html',
  styleUrls: ['./grid-item.component.less']
})
export class GridItemComponent implements OnInit, OnChanges {
  interact = (interactjs as any).default ? (interactjs as any).default : interactjs;
  @ViewChild(FlagDirective) flag: FlagDirective;
  // @Input() componentData;
  @Input() isDraggable = null;
  @Input() isResizable = null;
  @Input() minH = 1;
  @Input() minW = 1;
  @Input() maxW = Infinity;
  @Input() maxH = Infinity;
  @Input() x: number;
  @Input() y: number;
  @Input() w: number;
  @Input() h: number;
  @Input() i: number;
  @Input() dragIgnoreFrom = 'a, button';
  @Input() dragAllowFrom = null;
  @Input() resizeIgnoreFrom = 'a, button';

  @Input() cols = 1;
  @Input() rowHeight = 10;
  @Input() margin = [10, 10];
  @Input() maxRows = Infinity;
  @Input() useCssTransforms = false;
  @Input() static;

  @Input() componentType: string;    // 控件类型
  @Input() data;  // 控件数据

  private width;
  private initWidth = true;
  public isDragging = false;
  private dragging = null;
  public isResizing = false;
  private resizing = null;
  private lastX = NaN;
  private lastY = NaN;
  private lastW = NaN;
  private lastH = NaN;
  public style = {};
  public rtl = '';
  private dragEventSet = false;
  private resizeEventSet = false;

  private previousW = NaN;
  private previousH = NaN;
  private previousX = NaN;
  private previousY = NaN;

  private innerX = this.x;
  private innerY = this.y;
  private innerW = this.w;
  private innerH = this.h;
  private interactObj = null;

  // #if@computed
  public renderRtl = false; // (this.$parent.isMirrored) ? !this.rtl : this.rtl;
  public isAndroid = navigator.userAgent.toLowerCase().indexOf('android') !== -1;
  public resizableHandleClass = this.renderRtl ? 'vue-resizable-handle vue-rtl-resizable-handle' : 'vue-resizable-handle';

  // 视图容器
  @ViewChild('content', {read: ViewContainerRef}) content: ViewContainerRef;

  visible: boolean = false;
  validateForm: FormGroup;
  WidgetType: WidgetType[] = [
    {
      label: '菜单',
      value: 'menu'
    },
    {
      label: '图表',
      value: 'chart'
    }
  ];

  constructor(private _ngEl: ElementRef,
              private eventService: EventService,
              private componentFactoryResolver: ComponentFactoryResolver,
              private fb: FormBuilder) {
  }


  ngOnInit() {
    this.eventService._event.on('updateWidth', this.updateWidthHandler, this);
    this.eventService._event.on('compact', this.compactHandler, this);
    this.eventService._event.on('setDraggable', this.setDraggableHandler, this);
    this.eventService._event.on('setResizable', this.setResizableHandler, this);
    this.eventService._event.on('setRowHeight', this.updateWidth, this);
    this.eventService._event.on('directionchange', this.directionchangeHandler, this);
    this.eventService._event.on('setColNum', this.setColNum, this);
    this.loadComponent(this.componentType, this.data);
    this.InitConfigForm();
  }

  /**
   *  动态组件加载
   */
  loadComponent(componentType, data) {
    console.log('动态组件加载：');
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(GridDynamicComponent);
    // componentFactory.inputs.push({propName: 'componentType', templateName: 'data'});
    const com = this.content.createComponent(componentFactory);
    com.instance.componentType = componentType;
    com.instance.data = data;
    console.log('com.instance:::::');
    console.log(com.instance);
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('NgGridItem --->', this.width);
    if (this.initWidth) {
      this.width = this._ngEl.nativeElement.parentElement.offsetWidth;
      this.initWidth = false;
    }
    if (changes['isDraggable']) {
      this.isDraggable = changes['isDraggable'].currentValue;
      if (this.interactObj === null || this.interactObj === undefined) {
        // this.interactObj = interact(this._ngEl.nativeElement.children[0]);
        this.interactObj = this.interact(this._ngEl.nativeElement.children[0]);
      }
      if (this.isDraggable) {
        const opts = {
          ignoreFrom: this.dragIgnoreFrom,
          allowFrom: this.dragAllowFrom
        };
        this.interactObj.draggable(opts);
        /*this.interactObj.draggable({allowFrom: '.vue-draggable-handle'});*/
        if (!this.dragEventSet) {
          this.dragEventSet = true;
          this.interactObj.on('dragstart dragmove dragend', (event) => {
            this.handleDrag(event);
          });
        }
      } else {
        console.log('enabled: false');
        this.interactObj.draggable({
          enabled: false
        });
      }
    }
    if (changes['isResizable']) {
      this.isResizable = changes['isResizable'].currentValue;
      this.tryMakeResizable();
    }
    if (changes['rowHeight']) {
      // this.rowHeight = changes['rowHeight'].currentValue;
      this.createStyle();
    }
    if (changes['colNum']) {
      this.createStyle();
    }
    if (changes['x']) {
      this.innerX = changes['x'].currentValue;
      this.createStyle();
    }
    if (changes['y']) {
      this.innerY = changes['y'].currentValue;
      this.createStyle();
    }
    if (changes['h']) {
      this.innerH = changes['h'].currentValue;
      this.createStyle();
    }
    if (changes['w']) {
      this.innerW = changes['w'].currentValue;
      // this.createStyle();
    }
    if (changes['renderRtl']) {
      // this.tryMakeResizable();
      this.createStyle();
    }
  }

  public updateWidthHandler(width): void {
    this.updateWidth(width, null);
  }

  public compactHandler(layout): void {
    this.compact(layout);
  }

  /*
   * eventEmit 回调
   * */
  public setDraggableHandler(isDraggable) {
    if (this.isDraggable === null) {
      this.isDraggable = isDraggable;
    }
  }

  public setResizableHandler(isResizable) {
    if (this.isResizable === null) {
      this.isResizable = isResizable;
    }
  }

  public setRowHeightHandler(rowHeight) {
    this.rowHeight = rowHeight;
  }

  public directionchangeHandler() {
    this.rtl = getDocumentDir();
    this.compact(null);
  }

  public setColNum(colNum) {
    this.cols = parseInt(colNum, 10);
    this.eventService._cols = this.cols;
  }

  public createStyle() {
    // if (this.i >= 20) {
    //   console.log(this.i, 'createStyle', this);
    // }
    this.cols = this.eventService._cols;
    if (this.x + this.w > this.cols) {
      this.innerX = 0;
      this.innerW = (this.w > this.cols) ? this.cols : this.w;
    } else {
      this.innerX = this.x;
      this.innerW = this.w;
    }
    // console.log('createStyle ==>', this.innerX, this.innerY, this.innerW, this.innerH);
    const pos = this.calcPosition(this.innerX, this.innerY, this.innerW, this.innerH);


    if (this.isDragging) {
      pos.top = this.dragging.top;
      // Add rtl support
      if (this.renderRtl) {
        pos.right = this.dragging.left;
      } else {
        pos.left = this.dragging.left;
      }
    }
    if (this.isResizing) {
      pos.width = this.resizing.width;
      pos.height = this.resizing.height;
    }

    let style;
    // CSS Transforms support (default)
    if (this.useCssTransforms) {
      // Add rtl support
      if (this.renderRtl) {
        style = setTransformRtl(pos.top, pos.right, pos.width, pos.height);
      } else {
        style = setTransform(pos.top, pos.left, pos.width, pos.height);
      }

    } else { // top,left (slow)
      //  Add rtl support
      if (this.renderRtl) {
        style = setTopRight(pos.top, pos.right, pos.width, pos.height);
      } else {
        style = setTopLeft(pos.top, pos.left, pos.width, pos.height);
      }
    }
    this.style = style;
  }

  /**
   * Resize Event 伸缩事件
   */
  public handleResize(event) {
    const position = getControlPosition(event);
    if (position === null) {
      return;
    }
    const {x, y} = position;
    const newSize = {width: 0, height: 0};
    let pos;
    switch (event.type) {
      case 'resizestart': {
        this.previousW = this.innerW;
        this.previousH = this.innerH;
        pos = this.calcPosition(this.innerX, this.innerY, this.innerW, this.innerH);
        newSize.width = pos.width;
        newSize.height = pos.height;
        this.resizing = newSize;
        this.isResizing = true;
        break;
      }
      case 'resizemove': {
        // console.log('### resize => ' + event.type + ', lastW=' + this.lastW + ', lastH=' + this.lastH);
        const coreEvent = createCoreData(this.lastW, this.lastH, x, y);
        if (this.renderRtl) {
          newSize.width = this.resizing.width - coreEvent.deltaX;
        } else {
          newSize.width = this.resizing.width + coreEvent.deltaX;
        }
        newSize.height = this.resizing.height + coreEvent.deltaY;

        // /console.log("### resize => " + event.type + ", deltaX=" + coreEvent.deltaX + ", deltaY=" + coreEvent.deltaY);
        this.resizing = newSize;
        break;
      }
      case 'resizeend': {
        // console.log("### resize end => x=" +this.innerX + " y=" + this.innerY + " w=" + this.innerW + " h=" + this.innerH);
        pos = this.calcPosition(this.innerX, this.innerY, this.innerW, this.innerH);
        newSize.width = pos.width;
        newSize.height = pos.height;
        // console.log("### resize end => " + JSON.stringify(newSize));
        this.resizing = null;
        this.isResizing = false;
        break;
      }
    }

    // Get new WH
    pos = this.calcWH(newSize.height, newSize.width);
    if (pos.w < this.minW) {
      pos.w = this.minW;
    }
    if (pos.w > this.maxW) {
      pos.w = this.maxW;
    }
    if (pos.h < this.minH) {
      pos.h = this.minH;
    }
    if (pos.h > this.maxH) {
      pos.h = this.maxH;
    }

    if (pos.h < 1) {
      pos.h = 1;
    }
    if (pos.w < 1) {
      pos.w = 1;
    }

    this.lastW = x;
    this.lastH = y;
    this.eventService._event.emit('resizeEvent', event.type, this.i, this.innerX, this.innerY, pos.w, pos.h);
  }

  /**
   * Drag Event 拖拽事件
   */
  public handleDrag(event) {
    if (this.isResizing) {
      return;
    }
    const position = getControlPosition(event);
    // console.log('handleDrag', position, event);
    // console.log( 'position ', position);
    // Get the current drag point from the event. This is used as the offset.
    if (position === null) {
      return;
    } // not possible but satisfies flow
    const {x, y} = position;

    // let shouldUpdate = false;
    const newPosition = {top: 0, left: 0};
    switch (event.type) {
      case 'dragstart': {
        this.previousX = this.innerX;
        this.previousY = this.innerY;
        const parentRect = event.target.offsetParent.getBoundingClientRect();
        const clientRect = event.target.getBoundingClientRect();
        // const clientRect = event.target.children[0].getBoundingClientRect();
        // console.log('dragstart', parentRect, clientRect);
        if (this.renderRtl) {
          newPosition.left = (clientRect.right - parentRect.right) * -1;
        } else {
          newPosition.left = clientRect.left - parentRect.left;
        }
        newPosition.top = clientRect.top - parentRect.top;
        this.dragging = newPosition;
        this.isDragging = true;
        break;
      }
      case 'dragend': {
        if (!this.isDragging) {
          return;
        }
        // const parentRect = event.target.offsetParent.getBoundingClientRect();
        const parentRect = event.target.offsetParent.getBoundingClientRect();
        const clientRect = event.target.getBoundingClientRect();

        // const clientRect = event.target.children[0].getBoundingClientRect();
        // Add rtl support
        if (this.renderRtl) {
          newPosition.left = (clientRect.right - parentRect.right) * -1;
        } else {
          newPosition.left = clientRect.left - parentRect.left;
        }
        newPosition.top = clientRect.top - parentRect.top;
        //                        console.log("### drag end => " + JSON.stringify(newPosition));
        //                        console.log("### DROP: " + JSON.stringify(newPosition));
        this.dragging = null;
        this.isDragging = false;
        // shouldUpdate = true;
        break;
      }
      case 'dragmove': {
        const coreEvent = createCoreData(this.lastX, this.lastY, x, y);
        // Add rtl support
        if (this.renderRtl) {
          newPosition.left = this.dragging.left - coreEvent.deltaX;
        } else {
          newPosition.left = this.dragging.left + coreEvent.deltaX;
        }
        newPosition.top = this.dragging.top + coreEvent.deltaY;
        // console.log("### drag => " + event.type + ", x=" + x + ", y=" + y);
        // console.log("### drag => " + event.type + ", deltaX=" + coreEvent.deltaX + ", deltaY=" + coreEvent.deltaY);
        // console.log("### drag end => " + JSON.stringify(newPosition));
        this.dragging = newPosition;
        break;
      }
    }

    // Get new XY
    let pos;
    if (this.renderRtl) {
      pos = this.calcXY(newPosition.top, newPosition.left);
    } else {
      pos = this.calcXY(newPosition.top, newPosition.left);
    }

    this.lastX = x;
    this.lastY = y;

    this.eventService._event.emit('dragEvent', event.type, this.i, pos.x, pos.y, this.innerW, this.innerH);
  }

  public calcPosition(x, y, w, h): any {
    const colWidth = this.calcColWidth();
    let out;
    if (this.renderRtl) {
      out = {
        right: Math.round(colWidth * x + (x + 1) * this.margin[0]),
        top: Math.round(this.rowHeight * y + (y + 1) * this.margin[1]),
        width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * this.margin[0]),
        height: h === Infinity ? h : Math.round(this.rowHeight * h + Math.max(0, h - 1) * this.margin[1]),
      };
    } else {
      out = {
        left: Math.round(colWidth * x + (x + 1) * this.margin[0]),
        top: Math.round(this.rowHeight * y + (y + 1) * this.margin[1]),
        // 0 * Infinity === NaN, which causes problems with resize constriants;
        // Fix this if it occurs.
        // Note we do it here rather than later because Math.round(Infinity) causes deopt
        width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * this.margin[0]),
        height: h === Infinity ? h : Math.round(this.rowHeight * h + Math.max(0, h - 1) * this.margin[1])
      };
    }
    return out;
  }

  public calcXY(top, left): any {
    const colWidth = this.calcColWidth();
    let x = Math.round((left - this.margin[0]) / (colWidth + this.margin[0]));
    let y = Math.round((top - this.margin[1]) / (this.rowHeight + this.margin[1]));

    x = Math.max(Math.min(x, this.cols - this.innerW), 0);
    y = Math.max(Math.min(y, this.maxRows - this.innerH), 0);

    return {x, y};
  }

  // 计算父容器 宽度  返回 行宽
  public calcColWidth(): number {
    const colWidth = (this.width - (this.margin[0] * (this.cols + 1))) / this.cols;
    return colWidth;
  }

  public calcWH(height, width): any {
    const colWidth = this.calcColWidth();

    let w = Math.round((width + this.margin[0]) / (colWidth + this.margin[0]));
    let h = Math.round((height + this.margin[1]) / (this.rowHeight + this.margin[1]));

    w = Math.max(Math.min(w, this.cols - this.innerX), 0);
    h = Math.max(Math.min(h, this.maxRows - this.innerY), 0);
    return {w, h};
  }

  public updateWidth(width, colNum) {
    this.width = width;
    if (colNum !== undefined && colNum !== null) {
      this.cols = colNum;
    }
  }

  public compact(layout: any) {
    this.createStyle();
  }

  public tryMakeResizable() {
    if (this.interactObj === null || this.interactObj === undefined) {
      this.interactObj = this.interact(this._ngEl.nativeElement.querySelector('span'));
    }
    if (this.isResizable) {
      const maximum = this.calcPosition(0, 0, this.maxW, this.maxH);
      const minimum = this.calcPosition(0, 0, this.minW, this.minH);

      // console.log("### MAX " + JSON.stringify(maximum));
      // console.log("### MIN " + JSON.stringify(minimum));

      const opts = {
        preserveAspectRatio: true,
        // allowFrom: "." + this.resizableHandleClass,
        edges: {
          left: false,
          right: '.' + this.resizableHandleClass,
          bottom: '.' + this.resizableHandleClass,
          top: false
        },
        ignoreFrom: this.resizeIgnoreFrom,
        restrictSize: {
          min: {
            height: minimum.height,
            width: minimum.width
          },
          max: {
            height: maximum.height,
            width: maximum.width
          }
        }
      };

      this.interactObj.resizable(opts);
      if (!this.resizeEventSet) {
        this.resizeEventSet = true;
        this.interactObj
          .on('resizestart resizemove resizeend', (event) => {
            this.handleResize(event);
          });
      }
    } else {
      this.interactObj.resizable({
        enabled: false
      });
    }
  }

  public autoSize() {
    // ok here we want to calculate if a resize is needed
    if (this.i === -1) {
      return;
    }
    this.previousW = this.innerW;
    this.previousH = this.innerH;
    const childElement = this._ngEl.nativeElement.firstElementChild.firstElementChild.firstElementChild;
    console.log('autoSize', this._ngEl, childElement);
    // console.dir( childElement);
    const newSize = childElement.getBoundingClientRect();
    console.log('autoSize ===>', childElement, newSize);
    const pos = this.calcWH(newSize.height, newSize.width);
    if (pos.w < this.minW) {
      pos.w = this.minW;
    }
    if (pos.w > this.maxW) {
      pos.w = this.maxW;
    }
    if (pos.h < this.minH) {
      pos.h = this.minH;
    }
    if (pos.h > this.maxH) {
      pos.h = this.maxH;
    }

    if (pos.h < 1) {
      pos.h = 1;
    }
    if (pos.w < 1) {
      pos.w = 1;
    }
    console.log('pos -->', pos);
    // this.lastW = x; // basicly, this is copied from resizehandler, but shouldn't be needed
    // this.lastH = y;

    // if (this.innerW !== pos.w || this.innerH !== pos.h) {
    //     this.$emit("resize", this.i, pos.h, pos.w, newSize.height, newSize.width);
    // }
    if (this.previousW !== pos.w || this.previousH !== pos.h) {
      // this.$emit("resized", this.i, pos.h, pos.w, newSize.height, newSize.width);
      console.log('run resizeEvent');
      this.eventService._event.emit('resizeEvent', '', this.i, this.innerX, this.innerY, pos.w, pos.h);
    }
  }

  // public delGrid() {
  //   this.eventService._event.emit('removeGrid', this.i);
  // }
  //
  // public copyGrid() {
  //   this.eventService._event.emit('copyGrid', this.i);
  // }
  //
  // public addGrid() {
  //   this.eventService._event.emit('addGrid', this.i);
  // }

  /**
   * 配置控件
   */
  configure() {
    // this.ToConfigure.emit('outValue');
    this.visible = true;
    console.log('配置控件:');
    console.log(this.componentType);
    console.log(this.w);
    console.log(this.h);
    console.log(this.x);
    console.log(this.y);
    console.log(this.data);
  }

  get optionlist(): FormArray {
    return this.validateForm.get('optionlist') as FormArray;
  }

  InitConfigForm() {
    this.validateForm = this.fb.group({
      componentType: [this.componentType, [Validators.required]],
      w: [this.w, [Validators.required]],
      h: [this.h, [Validators.required]],
      x: [this.x, [Validators.required]],
      y: [this.y, [Validators.required]],
      optionlist: this.fb.array([
        this.fb.group({
          year: [null],
          value: [null],
        }),
      ]),
      desc: [null]
    });

    if (this.data.length > 0) {
      this.data.forEach((item) => {
        this.optionlist.push(this.fb.group({
          year: [item.year],
          value: [item.value]
        }));
      });
    }
  }

  /**
   * 添加图表值
   */
  addOption() {
    this.optionlist.push(this.fb.group({
      year: [''],
      value: ['']
    }));
  }

  /**
   * 删除图表值
   */
  delOption(index) {
    const control = <FormArray>this.validateForm.controls['optionlist'];
    control.removeAt(index);
  }

  onSubmitConfigForm() {
    for (const i in this.validateForm.controls) {
      this.validateForm.controls[i].markAsDirty();
      this.validateForm.controls[i].updateValueAndValidity();
    }

    console.log('提交表单配置。。。');
    console.log(this.validateForm.value);
    this.innerW = Number(this.validateForm.value.w);
    this.innerH = Number(this.validateForm.value.h);
    this.innerX = Number(this.validateForm.value.x);
    this.innerY = Number(this.validateForm.value.y);
    this.createStyle();

    this.componentType = this.validateForm.value.componentType;
    this.data = this.validateForm.value.optionlist;

    this.content.clear();
    this.loadComponent(this.componentType, this.data);
    this.validateForm.reset();

    const control = <FormArray>this.validateForm.controls['optionlist'];
    control.value.forEach((item, index) => {
      if (index > 0) {
        control.removeAt(index);
      }
    });
    this.visible = false;
  }
}
