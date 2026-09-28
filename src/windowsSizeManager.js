function windowsSizeManager() {
    var r = document.querySelector(':root');
    var rs = getComputedStyle(r);

    const sizeParams = {
        mobile: {
            maxWidth: 767,
            height: 100,
        },
        tablet: {
            maxWidth: 1023,
            height: 150,
        },
        desktop: {
            maxWidth: 1000000000,
            height: 200,
        },
    }

    let width = {
        current: window.innerWidth,
        last: null,
    }

    function init() {
        setHeightCellValue();

    }
    

    function getWidthValue() {
       return window.innerWidth;
    
    }    
    
    
    
    function setHeightCellValue() {
        const width = getWidthValue();
        let height = 0;

        if (width <= sizeParams.mobile.maxWidth) {
            height = sizeParams.mobile.height;
        } else if (width <= sizeParams.tablet.maxWidth) {
            height = sizeParams.tablet.height;
        } else {
            height = sizeParams.desktop.height;
        }
        r.style.setProperty("--td-height", height + "px");
        return height;
    }
    return {init, setHeightCellValue};
}
