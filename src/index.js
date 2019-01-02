const FUNCS = ["map", "forEach"];

function checkName(path) {
  return path.node.callee.property && FUNCS.indexOf(path.node.callee.property.name) > -1;
}

export default function (babel) {
  const { types: t } = babel;
  
  return {
    visitor: {
      IfStatement(path) {
        if (!t.isBlockStatement(path.node.consequent)) {
          path.node.consequent = t.blockStatement([ path.node.consequent ]);
        }
      },
      
      ForStatement(path) {
        if (!t.isBlockStatement(path.node.body)) {
          path.node.body = t.blockStatement([ path.node.body ]);
        }
      },
      
      WhileStatement(path) {
        if (!t.isBlockStatement(path.node.body)) {
          path.node.body = t.blockStatement([ path.node.body ]);
        }
      },
      
      ArrowFunctionExpression(path) {
        if (!t.isBlockStatement(path.node.body)) {
          path.node.body = t.blockStatement([ t.returnStatement(path.node.body) ]);
        }
      },
      
      CallExpression(path) {
        const parent = path.getStatementParent();

        // Don't modify if in ternary
        const excludeTernary = path.findParent((path) => path.isConditionalExpression());
        if (excludeTernary) return;

        let comments;
        if ((comments = parent.node.leadingComments) && comments[comments.length - 1]
            && /^\s*O:\s*KEEP/.test(comments[comments.length - 1].value)) {
          return;
        }


        const originalExpression = path.node.arguments[0];
        if (checkName(path) && path.node.arguments.length === 1 && !t.isIdentifier(originalExpression) && (path.node.callee.property.name === 'forEach' || t.isExpression(originalExpression.body)) && originalExpression.params[0].type === 'Identifier') {
          const name = path.node.callee.property.name;
          
          let arrayName = path.node.callee.object.name ? t.identifier(path.node.callee.object.name) : null;
          const resArrName = path.scope.generateUidIdentifier("r");
          const iterator = path.scope.generateUidIdentifier("i");
          const action = originalExpression.body;
          
          const resArray = name === "forEach" ? [] : [t.variableDeclaration(
            "const",
            [
              t.variableDeclarator(
                resArrName,
                t.arrayExpression()
              )
            ]
          )];


          if (arrayName == null) {
            arrayName = path.scope.generateUidIdentifier("a");
            resArray.push(
              t.variableDeclaration(
                "const",
                [
                  t.variableDeclarator(
                    arrayName,
                    path.node.callee.object
                  )
                ]
              )
            );
          }

          
          const expr = t.isExpression(action) ? t.callExpression(
            t.memberExpression(
              resArrName,
              t.identifier("push")
            ),
            [ action ]
          ) : null;

          const forBodyDeclarations = [
            t.variableDeclarator(
              t.identifier(originalExpression.params[0].name),
              t.memberExpression(arrayName, iterator, true)
            )
          ];

          if (originalExpression.params[1]) {
            forBodyDeclarations.push(
              t.variableDeclarator(
                t.identifier(originalExpression.params[1].name),
                iterator
              )
            );
          }
          if (originalExpression.params[2]) {
            forBodyDeclarations.push(
              t.variableDeclarator(
                t.identifier(originalExpression.params[2].name),
                arrayName
              )
            );
          }

          const forBody = [
            t.variableDeclaration(
              "const",
              forBodyDeclarations
            )];
          if (name === 'forEach') {
            if (action.type === 'BlockStatement') {
              forBody.push(...action.body);
            } else {
              forBody.push(t.expressionStatement(action));
            }
          } else {
              forBody.push(t.expressionStatement(expr));
          }
          
          path.getStatementParent().insertBefore([
            ...resArray,
            
            t.forStatement(
              t.variableDeclaration(
                "let",
                [
                  t.variableDeclarator(
                    iterator,
                    t.numericLiteral(0)
                  )
                ]
              ),
              t.binaryExpression(
                '<',
                iterator,
                t.memberExpression(
                  arrayName,
                  t.identifier('length')
                )
              ),
              t.updateExpression(
                '++',
                iterator
              ),
              t.blockStatement(forBody)
            )
          ]);
          
          path.replaceWith(name === "forEach" ? t.identifier("undefined") : resArrName);
        }
      }
    }
  };
}



