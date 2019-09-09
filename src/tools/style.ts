import { envConfig } from "./envConfig";

var fs = require("fs");

function loadStyles(): string {
  const defaultStyles = `
.application{ /*在这里设置整个应用的字体*/
    font-family: "微软雅黑","PingHei";
}

.focusText {
    /*modify the style of the focus result textarea*/
    /*font-family: Monaco;*/ /*设置专注模式的字体为 Monaco*/
}

.contrastText {
    /*modify the style of the contrast src and result textarea*/

}

.contrast {
    /*modify the style of the contrast mode panel*/
}
`;
  try {
    let styles = fs.readFileSync(envConfig.style, "utf-8");
    return styles.toString();
  } catch (e) {
    fs.writeFileSync(envConfig.style, defaultStyles);
    return defaultStyles;
  }
}

export { loadStyles };
