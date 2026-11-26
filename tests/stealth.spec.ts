
import {test,expect} from "@playwright/test";
test("top-down stealth view supports movement, camera switch and whistle",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");
 await page.getByRole("button",{name:"Solo heist"}).click();
 await page.getByLabel("Difficulty",{exact:true}).selectOption("easy");
 await page.getByRole("button",{name:"Ready up"}).click();
 await page.getByRole("button",{name:"Start heist"}).click();
 await page.keyboard.press("KeyF");
 await expect(page.locator("body")).toContainText("whistled");
 const dot=page.locator(".map svg>circle").last();
 const initial=Number(await dot.getAttribute("cy"));
 await page.keyboard.down("KeyW");
 await expect.poll(async()=>Number(await dot.getAttribute("cy"))).toBeLessThan(initial-.5);
 await page.keyboard.up("KeyW");
 await page.screenshot({path:"test-results/stealth-top-down.png"});
 await page.keyboard.press("KeyV");
 await page.waitForTimeout(400);
 await page.screenshot({path:"test-results/stealth-third-person.png"});
 expect(errors).toEqual([]);
});

