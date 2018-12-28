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


        if (checkName(path) && path.node.arguments.length === 1) {
          const name = path.node.callee.property.name;
          
          const arrayName = path.scope.generateUidIdentifier("a");
          const funcName = path.scope.generateUidIdentifier("f");
          const resArrName = path.scope.generateUidIdentifier("r");
          
          const iterator = path.scope.generateUidIdentifier("i");

          const call = t.callExpression(
            funcName,
            [
              t.memberExpression(
                arrayName,
                iterator,
                true
              ),
              iterator,
              arrayName
            ]
          );
          
          const resArray = name === "forEach" ? [] : [t.variableDeclaration(
            "const",
            [
              t.variableDeclarator(
                resArrName,
                t.arrayExpression()
              )
            ]
          )];
          
          const expr = t.callExpression(
            t.memberExpression(
              resArrName,
              t.identifier("push")
            ),
            [ call ]
          );
          
          path.getStatementParent().insertBefore([
            t.variableDeclaration(
              "const",
              [
                t.variableDeclarator(
                  arrayName,
                  path.node.callee.object
                )
              ]
            ),
            
            t.variableDeclaration(
              "const",
              [
                t.variableDeclarator(
                  funcName,
                  path.node.arguments[0]
                )
              ]
            ),
            
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
              t.expressionStatement(
                name === "forEach" ? call : expr
              )
            )
          ]);
          
          path.replaceWith(name === "forEach" ? t.identifier("undefined") : resArrName);
        }
      }
    }
  };
}



